import chalk from 'chalk';

export function printBanner() {
  console.clear();

  const asciiBanner = `
.-----------------------------------------------------------.
|███████╗███╗   ██╗██████╗  ██████╗ ██████╗ ██████╗ ███████╗|
|██╔════╝████╗  ██║██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝|
|█████╗  ██╔██╗ ██║██║  ██║██║     ██║   ██║██████╔╝█████╗  |
|██╔══╝  ██║╚██╗██║██║  ██║██║     ██║   ██║██╔══██╗██╔══╝  |
|███████╗██║ ╚████║██████╔╝╚██████╗╚██████╔╝██║  ██║███████╗|
|╚══════╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝|
'-----------------------------------------------------------'
`;

  const lines = asciiBanner.split('\n').map(line => line.trim());
  const terminalWidth = process.stdout.columns || 80;
  const centered = lines
    .map(line => line.padStart(Math.floor((terminalWidth + line.length) / 2)))
    .join('\n');

  console.log(chalk.cyanBright(centered));
  console.log(chalk.green(centerText('SOMNIA TESTNET AUTO DEPLOY & SEND TO RANDOM')));
  console.log(chalk.yellow(centerText('Telegram: https://t.me/e0303')));
  console.log(chalk.yellow(centerText('GitHub  : https://github.com/endijuan33')));
  console.log('\n');
}

function centerText(text) {
  const terminalWidth = process.stdout.columns || 80;
  return text.padStart(Math.floor((terminalWidth + text.length) / 2));
}
