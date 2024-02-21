import type { Chart } from "chart.js";
import { _ } from "svelte-i18n";
import { get } from "svelte/store";
import { colors, period } from "./Constants";
import { sessions } from "./Stores";

export class Mutex {
  private locked: boolean = false;
  private i: number = 0;

  async lock() {
    this.i++;
    if (this.locked) {
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!this.locked) {
            clearInterval(interval);
            resolve();
          }
        }, 100 + this.i);
      });
    }
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }

  async wrap(fn: Function) {
    await this.lock();
    await fn();
    this.unlock();
  }
}

export const createSession = () => {
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
    chart: { datasets: [] },

    start_at: +new Date(),
    last_at: 0,
    total_dmg: 0
  };
  sessions.update(v => {
    v.push(session);
    return v;
  });
  return session;
};

export const getActor = (data: ActorData) => {
  const $sessions = get(sessions);
  const record = $sessions[$sessions.length - 1];
  let actor = record.actors?.find(e => e.player_id === data[1]);
  if (!actor) {
    actor = {
      player_id: data[1],
      character_id: toHexString(data[2]),
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

export const getAction = (actor: ActorRecord, idx: number) => {
  let action = actor.actions?.find(e => e.idx === idx);
  if (!action) {
    action = { idx, hit: 0, dmg: 0, min: -1, max: -1 };
    if (!actor.actions) actor.actions = [];
    actor.actions.push(action);
  }
  return action;
};

export const pruneEvents = (session: Session) => {
  session.mutex.wrap(() => {
    if (!session?.events?.length) return;

    const min_time = +new Date() - 60000;
    while (session.events.length > 0) {
      const event = session.events[0];
      if (event.time > min_time) break;
      session.events.shift();

      const actor = getActor(event.source);
      actor.dmgm -= event.dmg;
      sessions.set(get(sessions));
    }
  });
};

let last_at = 0;

export const calculateDps = (session: Session, chart?: Chart) => {
  const $_ = get(_);
  session.mutex.wrap(() => {
    if (!session?.events?.length || !session.actors) {
      return;
    }

    const full = (session.last_at - session.start_at) / 1000;
    const real = (+new Date() - session.start_at) / 1000;
    const fullm = Math.min(60, real);

    for (const actor of session.actors) {
      actor.dps = Math.floor(actor.dmg / full);
      actor.dpsm = Math.floor(actor.dmgm / fullm);
    }

    if (real > 0 && last_at !== session.last_at) {
      if (period > 0) {
        const min_time = real - period;
        for (const dataset of session.chart.datasets) {
          const idx = dataset.data.findIndex(d => d.x > min_time);
          if (idx >= 0) {
            dataset.data = dataset.data.slice(idx);
          }
        }
      }

      session.actors.forEach(actor => {
        const label = `[${actor.party_idx + 1}] ` + $_(`actors.${actor.character_id}`);
        let dataset: DataSet | undefined = session.chart.datasets.find(ds => ds.label === label);
        if (!dataset) {
          dataset = {
            label,
            data: [],
            borderColor: colors[actor.party_idx],
            backgroundColor: colors[actor.party_idx],
            fill: false
          };
          session.chart.datasets.push(dataset);
        }
        dataset.data.push({ x: real, y: actor.dpsm || 0 });
      });

      chart?.update();
      last_at = session.last_at;
    }

    session.total_dps = session.actors.map(actor => actor.dps).reduce((sum, n) => (sum || 0) + (n || 0));
    sessions.set(get(sessions));
  });
};

export const formatTime = (start: number, end: number) => {
  const t = new Date(start);
  let result = `${t.getHours()}:${t.getMinutes()}`;

  const ms = end - start;
  if (ms > 0) {
    if (ms < 1000) {
      result += ` [${ms}ms]`;
    } else {
      const sec = Math.floor(ms / 1000);
      if (sec < 60) result += ` [${sec}s]`;
      else result += ` [${Math.floor(sec / 60)}m]`;
    }
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
