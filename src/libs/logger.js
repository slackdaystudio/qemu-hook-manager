import { platform, argv } from 'node:process';
import * as winston from 'winston';
import { consoleFormat } from 'winston-console-format';
import { Syslog } from 'winston-syslog';
import Yargs from 'yargs/yargs';

/**
 * The logger for the app.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

// The screen size for the logger.
export const SCREEN_SIZE = 80;

// Parse command line arguments
const args = Yargs(argv.slice(2)).argv;

// The formats for the logger
let formats = [];

// The console format options
let consoleFormatOptions = [winston.format.printf((info) => `${info.message}`)];

// If the verbose flag is set, add the colorize and pretty print options
if (args.verbose) {
  // The formats for the logger
  formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.ms(),
  ];

  consoleFormatOptions = [
    winston.format.colorize(),
    winston.format.splat({ depth: Infinity }),
    consoleFormat({
      showMeta: true,
      metaStrip: ['timestamp', 'service'],
      inspectOptions: {
        depth: Infinity,
        colors: true,
        maxArrayLength: Infinity,
        breakLength: SCREEN_SIZE,
        compact: Infinity,
      },
    }),
  ];
}

// The logger for the app.
export const logger = winston.createLogger({
  format: winston.format.combine(...formats),
  transports: [
    new winston.transports.Console({
      levels: winston.config.cli.levels,
      silent: false,
      format: winston.format.combine(...consoleFormatOptions),
    }),
    new Syslog({
        protocol: 'unix',
        path: platform === 'darwin' ? '/var/run/syslog' : '/dev/log',
        app_name: 'qemu-hook-manager',
        format: winston.format.printf((info) => `${info.message}`)
    }),
  ],
});