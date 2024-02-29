<script lang="ts" context="module">
  import Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { _ } from "svelte-i18n";

  import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
  import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";
  import { get } from "svelte/store";

  const headers: { key?: keyof ActorRecord; text: string }[] = [
    { key: "party_idx", text: "#" },
    { text: "Name" },
    { key: "dmg", text: "Damage" },
    { key: "dps", text: "DPS" },
    { key: "percentage", text: "%" }
  ];
</script>

<script lang="ts">
  import Breakdown from "./Breakdown.svelte";
  import { colors } from "./lib/Constants";
  import { sessions } from "./lib/Stores";
  import { calculateDps, pruneEvents } from "./lib/Utils";

  export let session: Session;

  let sortBy: keyof ActorRecord = "dmg";
  let descending = true;

  let chart: Chart | undefined;
  let canvas: HTMLCanvasElement;

  let showCanvas = true;
  let destroyed = false;
  let partyIdx = -1;
  let availableTargets = new Map<number, ActorRecord>();
  // Map of actor_player_id/target_player_id to actor records, used to filter based on the active target_player_id
  let activeActorsToTarget = new Map<string, ActorRecord>();
  // 0 represents no specific targets breakdown, ie: DPS without considering target
  let activeTargetPlayerID = 0;
  let totalDmgToTargetPlayerID = 0;
  let totalDPSToTargetPlayerID = 0;
  let data = session.chart.find(e => e.target_player_id === activeTargetPlayerID) ?? { datasets: [] };
  $: {
    session.actors = session.actors?.sort((a, b) => {
      if (descending) {
        return Number((getActiveTargetActor(a, activeTargetPlayerID) ?? a)[sortBy]) >
          Number((getActiveTargetActor(b, activeTargetPlayerID) ?? b)[sortBy])
          ? -1
          : 1;
      }
      return Number((getActiveTargetActor(a, activeTargetPlayerID) ?? a)[sortBy]) <
        Number((getActiveTargetActor(b, activeTargetPlayerID) ?? b)[sortBy])
        ? -1
        : 1;
    });

    // DMG Details breakdown to target
    totalDmgToTargetPlayerID = 0;
    totalDPSToTargetPlayerID = 0;
    session.actors?.forEach(a => {
      a.targets?.forEach(e => {
        totalDmgToTargetPlayerID += e.player_id === activeTargetPlayerID ? e.dmg : 0;
        totalDPSToTargetPlayerID += e.player_id === activeTargetPlayerID ? e?.dps ?? 0 : 0;
        availableTargets.set(e.player_id, e);
        activeActorsToTarget.set(getActiveTargetActorKey(a.player_id, e.player_id), e);
      });
      activeActorsToTarget.set(getActiveTargetActorKey(a.player_id, 0), a);
      totalDmgToTargetPlayerID += 0 === activeTargetPlayerID ? a.dmg : 0;
      totalDPSToTargetPlayerID += 0 === activeTargetPlayerID ? a?.dps ?? 0 : 0;
    });
    activeActorsToTarget = activeActorsToTarget;
    availableTargets = availableTargets;
  }

  $: if (showCanvas && canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (!chart) {
        chart = new Chart(ctx, {
          type: "line",
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              x: {
                type: "linear",
                position: "bottom",
                title: {
                  display: true,
                  text: "Time (seconds)"
                }
              },
              y: {
                //beginAtZero: true,
                position: "left",
                title: {
                  display: true,
                  text: "DPS"
                }
              }
            },
            animations: {
              y: { duration: 0 }
            },
            elements: {
              point: { radius: 0 }
            }
          }
        });
      } else {
        chart.data = data;
        chart.update();
      }
    }
  }

  const getActiveTargetActorKey = (actor_player_id: number, target_player_id: number) => {
    return `${actor_player_id}-${target_player_id}`;
  };

  const getActiveTargetActor = (actor: ActorRecord, target_player_id: number) => {
    return activeActorsToTarget.get(getActiveTargetActorKey(actor.player_id, target_player_id));
  };

  const updateEvents = () => {
    if (!session.mutex) return;
    if (session?.last_damage_at > 0) {
      pruneEvents(session);
      // Chart data details to target
      availableTargets.forEach(t => {
        let tempData = session.chart.find(e => e.target_player_id === t.player_id);
        if (!tempData) {
          tempData = { datasets: [], target_player_id: t.player_id };
          session.chart.push(tempData);
        }
      });
      let tempData = session.chart.find(e => e.target_player_id === activeTargetPlayerID);
      if (!tempData) {
        tempData = { datasets: [], target_player_id: activeTargetPlayerID };
        session.chart.push(tempData);
      }
      data = tempData;
      calculateDps(session, chart);
    }
    if (!destroyed && $sessions.indexOf(session) >= 0) {
      setTimeout(updateEvents, 1000);
    }
  };

  onMount(updateEvents);
  onDestroy(() => (destroyed = true));
</script>

{#if session.actors && session.total_dmg > 0}
  
  <table class="target-box">
    <tr>
      {#each [...availableTargets].sort() as [target_id, target]}
        {#if target.character_id !== "022a350f"}
        <td
          class="target-info"
          class:target-active={activeTargetPlayerID === target_id}
          on:click={() => {
            if (activeTargetPlayerID === target_id) {
              activeTargetPlayerID = 0;
            } else {
              activeTargetPlayerID = target_id;
            }
            data = session.chart.find(e => e.target_player_id === activeTargetPlayerID) ?? data;
          }}
        > 
          <button>
            {$_(`actors.${target.character_id}`).length == 0
              ? target_id
              : $_(`actors.${target.character_id}`)}    +    DAMAGE: ${target.dmgm.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`

          </button>
        </td>
      {/if}  
      {/each}
    </tr>
  </table>
  <table>
    <colgroup>
      <col width="50" />
      <col width="150" />
      <col span="1" />
      <col span="1" />
      <col span="1" />
      <col width="35" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header}
          <th
            scope="col"
            class={header.key ? "sortable" : undefined}
            data-active={sortBy === header.key || undefined}
            on:click={header.key
              ? () => {
                  if (header.key) sortBy = header.key;
                  descending = !descending;
                }
              : undefined}
          >
            {#if sortBy === header.key}
              <svelte:component this={descending ? SortDescending : SortAscending} size="2.1rem" />
            {/if}
            {header.text}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each session.actors as actor}
        {@const activeTargetActor = getActiveTargetActor(actor, activeTargetPlayerID)}
        {#if (actor.party_idx >= 0 && activeTargetActor?.dmg) || 0 > 0}
          <tr>
            <td>{actor.party_idx + 1}</td>
            <td style={`color: ${colors[actor.party_idx]}`}>{$_(`actors.${actor.character_id}`)}</td>
            <td>{(activeTargetActor?.dmg || 0).toLocaleString()}</td>
            <td>{(activeTargetActor?.dps || 0).toLocaleString()}</td>
            <td
              >{(Number((activeTargetActor?.dmg ?? 0) / totalDmgToTargetPlayerID || 0) * 100).toLocaleString(
                undefined,
                {
                  maximumFractionDigits: 1
                }
              )}%</td
            >
            <td style="padding: 0">
              <button
                type="button"
                style="width: 100%"
                on:click={() => (partyIdx = partyIdx === actor.party_idx ? -1 : actor.party_idx)}
              >
                {#if partyIdx === actor.party_idx}
                  <ChevronUp size="2.5rem" />
                {:else}
                  <ChevronDown size="2.5rem" />
                {/if}
              </button>
            </td>
          </tr>
          {#if partyIdx === actor.party_idx}
            <tr>
              <td colspan="100">
                <Breakdown {actor} target_id={activeTargetPlayerID} />
              </td>
            </tr>
          {/if}
        {/if}
      {/each}
    </tbody>
    {#if session.actors.length > 1}
      <tfoot>
        <tr>
          <th></th>
          <th></th>
          <th>{totalDmgToTargetPlayerID.toLocaleString()}</th>
          <th>{(totalDPSToTargetPlayerID || 0).toLocaleString()}</th>
        </tr>
      </tfoot>
    {/if}
  </table>
  <button
    type="button"
    on:click={() => {
      showCanvas = !showCanvas;
      if (!showCanvas) {
        chart = undefined;
      }
    }}
  >
    <svelte:component this={showCanvas ? ChevronUp : ChevronDown} size="2.5rem" />
  </button>
  {#if showCanvas}
    <canvas bind:this={canvas} />
  {/if}
{/if}
