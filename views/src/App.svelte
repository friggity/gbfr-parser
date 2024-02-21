<script lang="ts" context="module">
  import { onMount } from "svelte";
  import Close from "svelte-material-icons/Close.svelte";

  const debug = false;
</script>

<script lang="ts">
  import Session from "./Session.svelte";
  import { mutex, sessionIdx, sessions } from "./lib/Stores";
  import { createSession, formatTime, getAction, getActor, getTarget } from "./lib/Utils";

  let ws: WebSocket;
  let updateSessionIdx = false;
  let connected = false;

  const onDamage = (data: EventData) => {
    mutex.wrap(async () => {
      if (data.source[3] === -1 || !data.damage) return;

      let session = $sessions[$sessions.length - 1];
      if (!session) {
        session = createSession();
        updateSessionIdx = true;
      } else {
        await session.mutex.wrap(() => {
          session.last_at = +new Date();
        });
      }

      await session.mutex.wrap(() => {
        session.total_dmg += data.damage;

        const actor = getActor(data.source);
        actor.dmg += data.damage;
        actor.dmgm += data.damage;
        ++actor.hit;

        session.actors?.forEach(e => {
          e.percentage = e.dmg / session.total_dmg;
        });

        const target = getTarget(actor, data.target);
        target.dmg += data.damage;

        const action = getAction(actor, data.flags & (1 << 15) ? -3 : data.action_id);
        action.dmg += data.damage;
        ++action.hit;

        if (action.min === -1 || action.min > data.damage) action.min = data.damage;
        if (action.max === -1 || action.max < data.damage) action.max = data.damage;

        if (!session.events) session.events = [];
        session.events.push({
          time: session.last_at,
          dmg: data.damage,
          source: data.source,
          target: data.target
        });
      });

      sessions.set($sessions);
      if (updateSessionIdx) {
        updateSessionIdx = false;
        sessionIdx.set($sessions.length - 1);
      }
    });
  };

  onMount(() => {
    const init = () => {
      ws = new WebSocket("ws://localhost:24399");
      ws.addEventListener("message", ev => {
        if (debug) {
          console.debug(ev);
        }

        const msg: Message = JSON.parse(ev.data);
        switch (msg.type) {
          case "enter_area":
            createSession();
            updateSessionIdx = true;
            break;
          case "damage":
            onDamage(msg.data);
            break;
        }
      });
      ws.addEventListener("open", () => (connected = true));
      ws.addEventListener("close", () => setTimeout(init, 1000));
      ws.addEventListener("error", console.error);
    };

    init();
  });
</script>

{#if connected}
  {#if $sessions.some(session => session.total_dmg > 0)}
    <div id="main">
      <header>
        {#each $sessions as session, idx}
          {#if session.total_dmg > 0}
            <button
              class={$sessionIdx === idx ? "active" : undefined}
              type="button"
              on:click={() => ($sessionIdx = idx)}
            >
              {formatTime(session.start_at, session.last_at)}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <span
                on:click={() => {
                  sessions.update(v => {
                    v.splice(idx, 1);
                    if ($sessionIdx === idx) {
                      $sessionIdx = Math.max(0, idx - 1);
                    }
                    return v;
                  });
                }}
              >
                <Close size="1.8rem" />
              </span>
            </button>
          {/if}
        {/each}
      </header>
      <main>
        {#each $sessions as session, idx (session.start_at)}
          {#if idx === $sessionIdx}
            {#key session.start_at}
              <Session bind:session />
            {/key}
          {/if}
        {/each}
      </main>
    </div>
  {:else}
    <i>Waiting for battle events... </i>
  {/if}
{:else}
  <i>Establishing connection to WebSocket...</i>
{/if}
