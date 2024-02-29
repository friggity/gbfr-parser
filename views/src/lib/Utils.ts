import type { Chart } from "chart.js";
import { _ } from "svelte-i18n";
import { get } from "svelte/store";
import { colors, period } from "./Constants";
import Mutex from "./Mutex";
import { activeSession, mutex, sessions } from "./Stores";

export const loadSavedSessions = (): Session[] => {
  const json = localStorage.getItem("sessions");
  if (!json) return [];

  const data: Session[] = JSON.parse(json);
  data.forEach(session => {
    if ((session as any).last_at) {
      session.start_damage_at = session.start_at;
      session.last_damage_at = (session as any).last_at;
    }
  });

  return data;
};

export const saveSessions = () => {
  let clones: Session[] = JSON.parse(JSON.stringify(get(sessions)));
  clones = clones.filter(session => {
    delete session.mutex;
    session.done = true;
    return session.total_dmg > 0;
  });
  localStorage.setItem("sessions", JSON.stringify(clones));
};

export const createSession = (time: number) => {
  const $sessions = get(sessions);
  if ($sessions.length) {
    const session = $sessions[$sessions.length - 1];
    if (!session.done) {
      session.done = true;
      pruneEvents(session);
      calculateDps(session);
    }
  }

  const session: Session = {
    mutex: new Mutex(),
    chart: [],

    start_at: time,
    start_damage_at: 0,
    last_damage_at: 0,
    total_dmg: 0
  };
  sessions.update(v => {
    v.push(session);
    return v;
  });
  return session;
};

export const removeSession = (session: Session) => {
  mutex.wrap(() => {
    sessions.update(v => {
      v.splice(v.indexOf(session), 1);
      if (get(activeSession) === session) {
        activeSession.set(v[v.length - 1]);
      }
      return v;
    });
  });
};

export const getActor = (data: ActorData) => {
  const $sessions = get(sessions);
  const record = $sessions[$sessions.length - 1];
  const characterId = toHexString(data[2]);

  let actor = record.actors?.find(e => e.player_id === data[1] || (e.party_idx === data[3] && characterId));
  if (!actor) {
    actor = {
      player_id: data[1],
      character_id: characterId,
      party_idx: data[3],
      dmg: 0,
      dmgm: 0,
      hit: 0
    };
    if (!record.actors) record.actors = [];
    record.actors.push(actor);
  }
  return actor;
};

export const getTarget = (actor: ActorRecord, data: ActorData) => {
  let target = actor.targets?.find(e => e.player_id === data[1]);
  if (!target) {
    target = {
      player_id: data[1],
      character_id: toHexString(data[2]),
      party_idx: data[3],
      dmg: 0,
      dmgm: 0,
      hit: 0
    };
    if (!actor.targets) actor.targets = [];
    actor.targets.push(target);
  }
  return target;
};

export const getAction = (actor: ActorRecord, target: ActorRecord, idx: number) => {
  let action = actor.actions?.find(e => e.idx === idx && e.target_player_id === target.player_id);
  if (!action) {
    action = { idx, target_player_id: target.player_id, target_character_id: target.character_id, hit: 0, dmg: 0, min: -1, max: -1, pct: 0 };
    if (!actor.actions) actor.actions = [];
    actor.actions.push(action);
  }

  // 0 represents no specific targets breakdown, ie: DPS without considering target
  let defaultAction = actor.actions?.find(e => e.idx === idx && e.target_player_id === 0);
  if (!defaultAction) {
    defaultAction = { idx, target_player_id: 0, target_character_id: "", hit: 0, dmg: 0, min: -1, max: -1, pct: 0 };
    if (!actor.actions) actor.actions = [];
    actor.actions.push(defaultAction);
  }
  return [action, defaultAction];
};

export const modifyActionDamage = (action: ActionRecord, data: EventData) => {
  action.dmg += data.damage;
  ++action.hit;

  if (action.min === -1 || action.min > data.damage) action.min = data.damage;
  if (action.max === -1 || action.max < data.damage) action.max = data.damage;
  return action
}

export const pruneEvents = (session: Session) => {
  if (!session.mutex) return;

  mutex.wrap(() => {
    session.mutex?.wrap(() => {
      if (!session?.events?.length) return;

      const min_time = +new Date() - 60000;
      while (session.events.length > 0) {
        const event = session.events[0];
        if (event.time > min_time) break;
        session.events.shift();

        const actor = getActor(event.source);
        actor.dmgm -= event.dmg;
        const target = getActor(event.target);
        const eTarget = actor.targets?.find(e => e.player_id === target.player_id)
        if (eTarget) {
          eTarget.dmgm -= event.dmg
        }
        sessions.set(get(sessions));
      }
    });
  });
};

export const calculateDps = (session: Session, chart?: Chart) => {
  if (!session.mutex) return;
  const $_ = get(_);
  mutex.wrap(() => {
    session.mutex?.wrap(() => {
      if (!session?.events?.length || !session.actors) {
        return;
      }

      const full = (session.last_damage_at - session.start_damage_at) / 1000;
      const real = Math.round((+new Date() - session.start_damage_at) / 1000);
      const fullm = Math.min(60, real);

      for (const actor of session.actors) {
        actor.dps = Math.floor(actor.dmg / full);
        actor.dpsm = Math.floor(actor.dmgm / fullm);
        actor.targets?.forEach(e => {
          e.dps = Math.floor(e.dmg / full);
          e.dpsm = Math.floor(e.dmgm / fullm);
        })
      }

      if (real > 0 && session.last_chart_update !== session.last_damage_at) {
        if (period > 0) {
          const min_time = real - period;
          for (const charts of session.chart) {
            for (const dataset of charts.datasets) {
              const idx = dataset.data.findIndex(d => d.x > min_time);
              if (idx >= 0) {
                dataset.data = dataset.data.slice(idx);
              }
            }
          }
        }

        session.actors.forEach(actor => {
          if (actor.party_idx < 0) {
            return true
          }
          const label = `[${actor.party_idx + 1}] ` + $_(`actors.${actor.character_id}`);
          for (const charts of session.chart) {
            let dataset: DataSet | undefined = charts.datasets.find(ds => ds.label === label);
            if (!dataset) {
              dataset = {
                label,
                data: [],
                borderColor: colors[actor.party_idx],
                backgroundColor: colors[actor.party_idx],
                fill: false
              };
              charts.datasets.push(dataset);
            }
            if (charts.target_player_id) {
              dataset.data.push({ x: real, y: actor.targets?.find(e => e.player_id === charts.target_player_id)?.dpsm ?? 0 });
            } else {
              dataset.data.push({ x: real, y: actor.dpsm || 0 });
            }
            charts.datasets.sort((a, b) => a.label.localeCompare(b.label))
          }
        });
        chart?.update();
        session.last_chart_update = session.last_damage_at;
      }

      session.total_dps = session.actors.map(actor => actor.dps).reduce((sum, n) => (sum || 0) + (n || 0));
      sessions.set(get(sessions));
    });
  });
};

export const formatDuration = (start: number, end: number) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationInMilliseconds = Math.abs(endDate.getTime() - startDate.getTime());
  const minutes = Math.floor(durationInMilliseconds / 60000); // 1 minute = 60,000 milliseconds
  const seconds = Math.floor((durationInMilliseconds % 60000) / 1000); // Remaining milliseconds as seconds

  return `${minutes}m${seconds}s`;
};

export const formatTime = (start: number, end: number) => {
  const t = new Date(start);
  const formattedTime = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let result = formattedTime;
  if (end - start > 0) {
    result += ` [${formatDuration(start, end)}]`;
  }
  return result;
};

export const toHexString = (number: number) => {
  let hexString = number.toString(16);
  while (hexString.length < 8) {
    hexString = "0" + hexString;
  }
  return hexString;
};

export const isActionValid = (characterId: string, actionId: number) => {
  const $_ = get(_);

  if (!$_(`actions.common.${actionId}`).includes("actions.")) return true;
  return !$_(`actions.${characterId}.${actionId}`).includes("actions.");
};
