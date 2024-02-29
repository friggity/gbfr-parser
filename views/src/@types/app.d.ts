import { Mutex } from "../lib/Utils";

declare global {
  interface Message {
    type: "enter_area" | "damage";
    time_ms: number;
    data: EventData;
  }

  interface EventData {
    action_id: number;
    damage: number;
    flags: number;
    source: ActorData;
    target: ActorData;
  }

  // [0]source_type, [1]player_id, [2]character_id, [3]party_idx
  type ActorData = [string, number, number, number];

  interface EventRecord {
    time: number;
    dmg: number;
    source: ActorData;
    target: ActorData;
  }

  interface ActionRecord {
    idx: number;
    target_player_id: number;
    target_character_id: string;
    hit: number;
    dmg: number;
    min: number;
    max: number;
    pct: number;
  }

  interface ActorRecord {
    player_id: number;
    character_id: string;
    party_idx: number;

    dmg: number;
    dmgm: number;
    hit: number;

    dps?: number;
    dpsm?: number;
    percentage?: number;

    targets?: ActorRecord[];
    actions?: ActionRecord[];
  }

  interface Session {
    mutex?: Mutex;
    done?: boolean;
    chart: ChartData[];

    start_at: number;
    start_damage_at: number;
    last_damage_at: number;
    total_dmg: number;
    total_dps?: number;
    events?: EventRecord[];
    actors?: ActorRecord[];
    last_chart_update?: number;
  }

  interface DataSet {
    label: string;
    data: { x: number; y: number }[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
  }

  interface ChartData {
    target_player_id?: number;
    datasets: DataSet[];
  }
}
