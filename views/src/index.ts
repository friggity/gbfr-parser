import { Chart } from "chart.js";
import { addMessages, getLocaleFromNavigator, init } from "svelte-i18n";
import App from "./App.svelte";
import en from "./en.json";
import "./styles/app.sass";

addMessages("en", en);
init({
  fallbackLocale: "en",
  initialLocale: getLocaleFromNavigator()
});

Chart.defaults.color = "hsl(0, 0%, 80%)";
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
Chart.defaults.font.size = 14;

const target = document.getElementById("root");
if (target) {
  target.firstElementChild?.remove();
  new App({ target: target });
}
