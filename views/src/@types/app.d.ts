import { Mutex } from "../lib/Utils";

declare global {
  interface Message {
    type: "enter_area" | "damage";
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
    hit: number;
    dmg: number;
    min: number;
    max: number;
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
    mutex: Mutex;
    chart: ChartData;
    done?: boolean;

    start_at: number;
    last_at: number;
    total_dmg: number;
    total_dps?: number;
    events?: EventRecord[];
    actors?: ActorRecord[];
  }

  interface DataSet {
    label: string;
    data: { x: number; y: number }[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
  }

  interface ChartData {
    datasets: DataSet[];
  }
}
