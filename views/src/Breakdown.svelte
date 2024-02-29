<script lang="ts" context="module">
  import { _ } from "svelte-i18n";
  import { get } from "svelte/store";

  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";

  const headers: { key?: keyof ActionRecord; text: string }[] = [
    { text: "Name" },
    { key: "hit", text: "Hits" },
    { key: "dmg", text: "Damage" },
    { key: "min", text: "Min. DMG" },
    { key: "max", text: "Max. DMG" },
    { key: "pct", text: "DMG %" }
  ];
</script>

<script lang="ts">
  export let actor: ActorRecord;
  export let target_id: number;
  let sortBy: keyof ActionRecord = "dmg";
  let descending = true;

  $: {
    actor.actions = actor.actions?.sort((a, b) => {
      if (descending) {
        return Number(a[sortBy]) > Number(b[sortBy]) ? -1 : 1;
      }
      return Number(a[sortBy]) < Number(b[sortBy]) ? -1 : 1;
    });
    actor.actions?.forEach(e => {
      let total_dmg = target_id === 0 ? actor.dmg : actor.targets?.find(e => e.player_id === target_id)?.dmg ?? 0;
      e.pct = total_dmg === 0 ? 0 : e.dmg / total_dmg;
    });
  }

  const getFilteredAction = (actions: ActionRecord[], target_id: number) => {
    return actions.filter(x => x.target_player_id === target_id);
  };

  const getActionName = (characterId: string, actionId: number) => {
    const $_ = get(_);

    if (characterId === "26a4848a") {
      characterId = "9498420d";
    }

    let v = $_(`actions.common.${actionId}`);
    if (v.startsWith("actions.")) {
      v = $_(`actions.${characterId}.${actionId}`);
    }
    return v.startsWith("actions.") ? actionId : v;
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<table>
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
    {#if actor.actions?.length}
      {#each getFilteredAction(actor.actions, target_id) || [] as action}
        <tr>
          <td>{getActionName(actor.character_id, action.idx)}</td>
          <td>{action.hit.toLocaleString()}</td>
          <td>{action.dmg.toLocaleString()}</td>
          <td>{action.min.toLocaleString()}</td>
          <td>{action.max.toLocaleString()}</td>
          <td
            >{(Number(action.pct || 0) * 100).toLocaleString(undefined, {
              maximumFractionDigits: 1
            })}%</td
          >
        </tr>
      {/each}
    {/if}
  </tbody>
</table>
