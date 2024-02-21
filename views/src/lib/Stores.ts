import { writable, type Updater } from "svelte/store";
import { Mutex } from "./Utils";

export const sessions = (() => {
  const { set: origSet, update: origUpdate, subscribe } = writable<Session[]>([]);
  const mutex = new Mutex();

  const set = (value: Session[]) => mutex.wrap(() => origSet(value));
  const update = (updater: Updater<Session[]>) => mutex.wrap(() => origUpdate(updater));

  return {
    set,
    update,
    subscribe
  };
})();

export const sessionIdx = (() => {
  const { set: origSet, update: origUpdate, subscribe } = writable<number>(0);
  const mutex = new Mutex();

  const set = (value: number) => mutex.wrap(() => origSet(value));
  const update = (updater: Updater<number>) => mutex.wrap(() => origUpdate(updater));

  return {
    set,
    update,
    subscribe
  };
})();

export const mutex = new Mutex();
