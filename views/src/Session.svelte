<script lang="ts" context="module">
  import Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { _ } from "svelte-i18n";

  import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
  import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";

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

  let showCanvas = false;
  let destroyed = false;
  let partyIdx = -1;

  $: {
    session.actors = session.actors?.sort((a, b) => {
      if (descending) {
        return Number(a[sortBy]) > Number(b[sortBy]) ? -1 : 1;
      }
      return Number(a[sortBy]) < Number(b[sortBy]) ? -1 : 1;
    });
  }
  $: if (showCanvas && canvas && !chart) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      chart = new Chart(ctx, {
        type: "line",
        data: session.chart,
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
    }
  }

  const updateEvents = () => {
    if (session?.last_at > 0) {
      pruneEvents(session);
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
      {#each session.actors as actor, idx}
        {#if actor.party_idx >= 0}
          <tr>
            <td>{actor.party_idx + 1}</td>
            <td style={`color: ${colors[actor.party_idx]}`}>{$_(`actors.${actor.character_id}`)}</td>
            <td>{actor.dmg.toLocaleString()}</td>
            <td>{(actor.dps || 0).toLocaleString()}</td>
            <td>{(Number(actor.percentage || 0) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td>
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
                <Breakdown {actor} />
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
          <th>{session.total_dmg.toLocaleString()}</th>
          <th>{(session.total_dps || 0).toLocaleString()}</th>
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
