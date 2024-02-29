<script lang="ts" context="module">
  import { afterUpdate, onMount } from "svelte";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";

  import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
  import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
  import Close from "svelte-material-icons/Close.svelte";

  const debug = false;
</script>

<script lang="ts">
  import html2canvas from "html2canvas";
  import Session from "./Session.svelte";
  import { activeSession, mutex, sessions } from "./lib/Stores";
  import {
    createSession,
    formatTime,
    getAction,
    getActor,
    getTarget,
    loadSavedSessions,
    modifyActionDamage,
    removeSession,
    saveSessions
  } from "./lib/Utils";
  import { writable } from "svelte/store";

  let ws: WebSocket;
  let updateActiveSession = false;
  let connected = false;

  let swiperRoot: HTMLElement;
  let prevBtn: HTMLElement;
  let nextBtn: HTMLElement;
  let swiper: Swiper;

  const onDamage = (data: EventData, time: number) => {
    mutex.wrap(async () => {
      if (data.source[3] === -1 || data.damage <= 0) return;

      let session = $sessions[$sessions.length - 1];
      if (!session || session.done) {
        session = createSession(time);
        updateActiveSession = true;
      } else if (session.mutex) {
        await session.mutex.wrap(() => {
          session.last_damage_at = time;
        });
      } else return;

      if (session.mutex && !session.start_damage_at) {
        await session.mutex.wrap(() => {
          session.start_damage_at = time;
        });
      }

      await session.mutex?.wrap(() => {
        session.total_dmg += data.damage;

        const actor = getActor(data.source);
        const target = getTarget(actor, data.target);
        

        if (target.character_id === "022a350f") return;

        actor.dmg += data.damage;
        actor.dmgm += data.damage;
        ++actor.hit;


        session.actors?.forEach(e => {
          e.percentage = e.dmg / session.total_dmg;
        });

        target.dmg += data.damage;
        target.dmgm += data.damage;

        let [action, defaultAction] = getAction(actor, target, data.flags & (1 << 15) ? -3 : data.action_id);
        action = modifyActionDamage(action, data);
        defaultAction = modifyActionDamage(defaultAction, data);

        if (!session.events) session.events = [];
        session.events.push({
          time: time,
          dmg: data.damage,
          source: data.source,
          target: data.target
        });
      });

      sessions.set($sessions);
      if (updateActiveSession) {
        updateActiveSession = false;
        $activeSession = session;

        if (swiper) {
          window.requestAnimationFrame(() => swiper.update());
          window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
        }
      }
    });
  };

  afterUpdate(() => {
    if (swiperRoot && !swiper) {
      swiper = new Swiper(swiperRoot, {
        slidesPerView: "auto",
        centeredSlides: false,
        allowTouchMove: false,
        freeMode: true,
        navigation: {
          nextEl: ".slider-next",
          prevEl: ".slider-prev"
        },
        modules: [Navigation]
      });

      window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
    }
  });

  let mainDiv: HTMLElement;

  function fillValues(s: any) {
    var obj = {
      Cagliostro: "",
      Charlotta: "",
      Eugen: "",
      Ferry: "",
      Ghandagoza: "",
      "Gran/Djeeta": "",
      Id: "",
      Io: "",
      Katalina: "",
      Lancelot: "",
      Narmaya: "",
      Percival: "",
      Rackam: "",
      Rosetta: "",
      Siegfried: "",
      Vane: "",
      Vaseraga: "",
      Yodarha: "",
      Zeta: ""
    } as any;
    var lines = s.split("\n");
    for (var i = 0; i < lines.length; i += 2) {
      var name = lines[i];
      var value = lines[i + 1];

      if (name === "Gran" || name === "Djeeta") {
        name = "Gran/Djeeta";
      }

      if (obj.hasOwnProperty(name) && obj[name] === "") {
        obj[name] = value;
      }
    }

    return obj;
  }

  // copy text
  async function getTableColumnValues() {
    var table = document.querySelector("main table tbody") as any;

    var columnValues = [];

    for (var i = 0; i < table.rows.length; i++) {
      var secondCell = table.rows[i].cells[1]; // Index is 0-based
      var fourthCell = table.rows[i].cells[3]; // Index is 0-based

      columnValues.push(secondCell.textContent, fourthCell.textContent);
    }

    return columnValues.join("\n");
  }

  async function getAvgSessionData() {
    // Check that at least one session exists
    if ($sessions.length == 0) {
      return;
    }

    // Declare list and store first session
    var objList = [];
    var session = $sessions[0];

    // Store actor data in list for further manipulation
    for (var i = 0; i < session.actors.length; i++) {
      var obj = {
        id: session.actors[i].character_id,
        dpsSum: session.actors[i].dps
      } as any;
      objList.push(obj);
    }

    // If only one session, return session data
    if ($sessions.length == 1) {
      return getAvgOutputString(objList);
    }

    // Iterate through sessions and aggregate data
    for (var i = 1; i < $sessions.length; i++) {
      session = $sessions[i];
      if (objList.length > 0)
        for (var j = 0; j < objList.length; j++)
          for (var k = 0; k < objList.length; k++)
            if (objList[j].id == session.actors[k].character_id)
              objList[j].dps += session.actors[k].dps;
    }

    // Average dps data
    for (var i = 0; i < objList.length; i++) {
      objList[i].dps = objList[i].dps / $sessions.length;
    }

    // Return data
    return getAvgOutputString(objList);

  }

  async function getAvgOutputString(o: any) {
    var values = [];
    var total = 0;
    for (var i = 0; i < o.length; i++) {
      values.push(o.id, o.dps);
      total += o.dps;
    }
    values.push("Total", total);
    values.join("\n");

    return values;
  }

  async function captureChat() {
    const valuesStr = await getTableColumnValues();

    await navigator.clipboard.writeText(valuesStr);
  }

  async function captureTab() {
    const valuesStr = await getTableColumnValues();
    const values = fillValues(valuesStr);
    const tabValues = Object.values(values).join("\t");

    await navigator.clipboard.writeText(tabValues);
  }

  async function capture() {
    const canvas = await html2canvas(mainDiv);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob
        } as any)
      ]);
      console.log("Image copied to clipboard");
    } catch (err) {
      console.error(err);
    }
  }

  onMount(() => {
    const savedSessions = loadSavedSessions();
    if (savedSessions) {
      $sessions = savedSessions;
      $activeSession = $sessions[$sessions.length - 1];
    }

    const init = () => {
      ws = new WebSocket("ws://localhost:24399");
      ws.addEventListener("message", ev => {
        if (debug) {
          console.debug(ev);
        }

        const msg: Message = JSON.parse(ev.data);
        if (!msg.time_ms) {
          msg.time_ms = +new Date();
        }
        switch (msg.type) {
          case "enter_area":
            createSession(msg.time_ms);
            updateActiveSession = true;
            break;
          case "damage":
            onDamage(msg.data, msg.time_ms);
            break;
        }
      });
      ws.addEventListener("open", () => (connected = true));
      ws.addEventListener("close", () => setTimeout(init, 1000));
      ws.addEventListener("error", console.error);
    };

    init();

    const save = () => {
      saveSessions();
      window.setTimeout(save, 3000);
    };
    save();
  });
</script>


{#if !connected}
    <div class="alert alert-3-danger">
      <i class="alert-content">Failed to connect to websocket server, check injector status...</i>
    </div>
  {/if}
    {#if $sessions.some(session => session.total_dmg > 0)}
						<div id="main" bind:this={mainDiv}>
      	<header>
        <button class="slider-prev" bind:this={prevBtn}>
          <ChevronLeft size="2.1rem" />
        </button>
        <div class="slider-wrapper">
          <div class="swiper" bind:this={swiperRoot}>
            <div class="swiper-wrapper">
              {#each $sessions as session, idx}
                {#if session.total_dmg > 0}
                  <button
                    class={`swiper-slide` + ($activeSession === session ? " active" : "")}
                    type="button"
                    on:click|self={() => ($activeSession = session)}
                  >
                    {formatTime(session.start_damage_at, session.last_damage_at)}
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <span
                      on:click={() => {
                        removeSession(session);
                        if (swiper) {
                          window.requestAnimationFrame(() => swiper.update());
                          if ($activeSession === session) {
                            window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
                          }
                        }
                      }}
                    >
                      <Close size="1.6rem" />
                    </span>
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        </div>
        <button class="slider-next" bind:this={nextBtn}>
          <ChevronRight size="2.1rem" />
        </button>
      </header>
      <main>
        {#each $sessions as session (session.start_at)}
          {#if $activeSession === session}
            {#key session.start_at}
              <Session bind:session />
            {/key}
          {/if}
        {/each}
      </main>
					</div>	
      <div>
        <button id="capture" on:click={capture} class="button">Copy Image</button>
        <button id="capture1" on:click={captureTab} class="button">Copy Tab</button>
        <button id="capture2" on:click={captureChat} class="button">Copy chat</button>
        <button id="capture3" on:click={getAvgSessionData} class="button">Copy Avg DPS Data</button>
      </div>
  {:else}
      <i>Waiting for battle events... </i>
 	{/if}
