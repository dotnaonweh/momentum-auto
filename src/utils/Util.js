import chalk from "chalk";
import boxen from "boxen";

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function printAuthorInfo() {
  const message =
    `${chalk.green("🧙 Author:")} ${chalk.bold("0xFantasy")}\n` +
    `${chalk.gray("More scripts:")} ${chalk.underline.blue(
      "https://x.com/0Xiaofan22921"
    )}`;

  const box = boxen(message, {
    padding: 1,
    borderColor: "green",
    borderStyle: "round",
    align: "center",
  });

  console.log(box);
}
