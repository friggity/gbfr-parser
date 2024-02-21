import { addMessages, getLocaleFromNavigator, init } from "svelte-i18n";
import App from "./App.svelte";
import en from "./en.json";
import "./styles/app.sass";

addMessages("en", en);
init({
  fallbackLocale: "en",
  initialLocale: getLocaleFromNavigator()
});

const target = document.getElementById("root");
if (target) {
  target.firstElementChild?.remove();
  new App({ target: target });
}
