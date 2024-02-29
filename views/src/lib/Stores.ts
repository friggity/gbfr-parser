import { writable } from "svelte/store";
import Mutex from "./Mutex";

export const sessions = writable<Session[]>([]);
export const activeSession = writable<Session>();
export const mutex = new Mutex();
