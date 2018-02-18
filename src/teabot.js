import config from "./conf";
import Round from "./round";
import slack from "./slack";
import { random } from "./utils";
import User from "./models/user";
import type { SlackMessage, SlackUser } from "./slack";

const HELP_TEXT = `
    Welcome to ${config.beverageName}bot v2.
`;

export default class {
    _round: ?Round = null;

    constructor() {
        console.log("Starting Teabot!");

        // Begin listening for commands
        this.bindCommands();
    }

    get round() {
        return this._round && this._round.active ? this._round : null;
    }

    set round(value) {
        this._round = value;
    }

    startRound = (user: SlackUser): void => {
        if (!this.round) {
            this.round = new Round(user, this.completeRound);
        }
    };

    completeRound = (round: Round) => {
        if (!round.customers.length) {
            slack.sendMessage(
                "Time is up! Looks like no one else wants a cuppa."
            );
        } else {
            const colors = ["#1d2d3b", "#52aad8", "#273a4b", "#52aad8"];
            let attachments = round.customers.map((user, idx) => ({
                author_icon: user.picture,
                author_name: `@${user.username}`,
                color: colors[idx % colors.length],
                text: `${user.name} would like ${user.tea_type}`,
                footer: `${user.teas_brewed} brewed | ${
                    user.teas_received
                } received | ${user.teas_drunk} consumed`
            }));

            slack.sendMessage("Time is up!", { attachments });
        }
    };

    bindCommands() {
        slack.messageHandler(async (message: SlackMessage) => {
            const slackUser = await slack.findUser(message.user);

            // Ensure user is a database
            const user = await User.fromSlack(slackUser);

            const pattern = new RegExp(
                "\\s*<@" + RegExp.escape(slack.user.id) + ">:?\\s(.*)"
            );
            const match = message.text.match(pattern);
            if (match) {
                const command = match[1];
                this.processCommand(command, user, message);
            }
        });
    }

    processCommand(command: string, user: User, message: SlackMessage) {
        const commands = [
            ["register", this.register],
            [["brew", ":tea:"], this.brew],
            [["me", ":woman_raising_hand:", ":man_raising_hand:"], this.me],
            [["timer", "remaining"], this.timer],
            [["help", "info"], this.help],
            ["ping", this.ping],
            [["hi", "hello", "yo"], this.hello]
        ];

        const pattern = /\s*(:?\w+:?)(\s+(.*))?/i;
        const match = command.match(pattern);

        if (match) {
            const action = match[1].toLowerCase();
            const args = match[3];

            const command = commands.find(cmd => {
                const [aliases, fn] = cmd;
                if (
                    aliases instanceof String
                        ? aliases == action
                        : aliases.indexOf(action) > -1
                ) {
                    return true;
                }
            });

            if (command) {
                const [_, fn] = command;
                fn(user, args, message);
            } else {
                slack.sendMessage(
                    `I did not understand that command. For help type \`@${
                        slack.user.name
                    } help\`.`
                );
            }
        }
    }

    register = (user: User, preference: string) => {
        if (!preference) {
            slack.sendMessage(
                `You didn't tell me what type of ${
                    config.beverageName
                } you like.\n\nTry typing \`@${
                    slack.user.name
                } register milky ${config.beverageName}\``
            );
        }

        slack.sendMessage(
            // TODO: add message about how to brew and how to request depending
            // on if this.round is true
            user.registered
                ? `I've updated your ${config.beverageName} preference`
                : `Welcome to the ${config.beverageName} party ${user.name}`
        );

        user.tea_type = preference;
        user.save();
    };

    brew = async (user: User, args, message: SlackMessage) => {
        if (this.round) {
            slack.sendMessage(
                this.round.server.id == user.id
                    ? `You have already offered to make ${config.beverageName}!`
                    : `Someone is already making ${
                          config.beverageName
                      }. Want in?`
            );
            return;
        }

        this.startRound(user);
        const text = `<@${user.slack_id}> is making ${
            config.beverageName
        }. Who's in?`;
        slack.addReaction(
            random(["tea", "raised_hands", "thumbsup", "clap"]),
            message
        );
        return await slack.sendMessage(text);
    };

    me = async (user: User, args, message: SlackMessage) => {
        if (!user.registered) {
            slack.sendMessage(
                `You must register your tea preference first. Try \`@${
                    slack.user.name
                } register green tea\``
            );
            return;
        }

        if (!this.round) {
            slack.sendMessage(
                `No one has volunteered to make ${
                    config.beverageName
                }, why dont you make it ${user.name}?`
            );
            return;
        }

        if (this.round.server.id == user.id) {
            slack.sendMessage(
                `${user.name} you are making the ${
                    config.beverageName
                }! :face_with_rolling_eyes:`
            );
            return;
        }

        if (this.round.hascustomer(user)) {
            slack.sendMessage(`You said it once already ${user.name}.`);
            return;
        }

        this.round.addcustomer(user);
        ["thumbsup", "tea"].forEach(emoji => slack.addReaction(emoji, message));
    };

    hello = user => {
        slack.sendMessage(`Hello ${user.name}! :wave:`);
    };

    timer = () =>
        this.round
            ? slack.sendMessage(
                  `:timer_clock: ${
                      this.round.timeRemaining
                  } seconds remaining...`
              )
            : slack.sendMessage(`No one is making ${config.beverageName}`);

    help = () => slack.sendMessage(HELP_TEXT);
    ping = () => slack.sendMessage("Pong! :table_tennis_paddle_and_ball:");
}
