import config from "./conf";
import Round from "./round";
import slack from "./slack";
import { random } from "./utils";
import { Op } from "sequelize";
import User from "./models/user";
import type { SlackMessage, SlackUser } from "./slack";

const COLORS = ["#1d2d3b", "#52aad8", "#273a4b", "#52aad8"];

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
            let attachments = round.customers.map((user, idx) => ({
                author_icon: user.picture,
                author_name: `@${user.username}`,
                color: COLORS[idx % COLORS.length],
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
            ["leaderboard", this.leaderboard],
            [["directory", "users"], this.directory],
            ["stats", this.stats],
            ["info", this.info],
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

    leaderboard = async user => {
        const users = await User.findAll({
            where: {
                tea_type: {
                    [Op.ne]: null
                },
                teas_brewed: {
                    [Op.gt]: 0
                },
                [Op.or]: [{ deleted: null }, { deleted: 0 }]
            },
            order: [["teas_brewed", "DESC"]]
        });

        const lines = users.map(
            (user, idx) =>
                `${idx + 1}. _${user.name}_ has brewed *${
                    user.teas_brewed
                }* cups of ${config.beverageName}`
        );
        slack.sendMessage("*Teabot Leaderboard*\n" + lines.join("\n"));
    };

    directory = async user => {
        const users = await User.findAll({
            where: {
                tea_type: {
                    [Op.ne]: null
                },
                [Op.or]: [{ deleted: null }, { deleted: 0 }]
            },
            order: [["username", "DESC"]]
        });

        const attachments = users.map((user, idx) => ({
            author_icon: user.picture,
            author_name: `@${user.username}`,
            color: COLORS[idx % COLORS.length],
            text: `${user.name} likes ${user.tea_type}`
        }));
        slack.sendMessage(`There are ${users.length} registered users.`, {
            attachments
        });
    };

    stats = async user => {
        const users = await User.findAll({
            where: {
                tea_type: {
                    [Op.ne]: null
                },
                teas_brewed: {
                    [Op.gt]: 0
                },
                [Op.or]: [{ deleted: null }, { deleted: 0 }]
            },
            order: [["teas_brewed", "DESC"]]
        });

        const attachments = users.map((user, idx) => ({
            author_icon: user.picture,
            author_name: `@${user.username}`,
            color: COLORS[idx % COLORS.length],
            footer: `${user.teas_brewed} brewed | ${
                user.teas_received
            } received | ${user.teas_drunk} consumed`
        }));
        slack.sendMessage(
            `Statistics for ${users.length} registered brewers.`,
            {
                attachments
            }
        );
    };

    info = async (user, lookup) => {
        // TODO: remove @ prefix and trim lookup

        const matchingUser = await User.findOne({
            where: {
                username: lookup
            },
            order: [["username", "DESC"]]
        });

        if (!matchingUser) {
            slack.sendMessage("User not found!");
            return;
        }

        const attachment = {
            author_icon: matchingUser.picture,
            author_name: `@${matchingUser.username}`,
            color: COLORS[0],
            text: `${user.name} likes ${user.tea_type}`,
            footer: `${matchingUser.teas_brewed} brewed | ${
                matchingUser.teas_received
            } received | ${matchingUser.teas_drunk} consumed`
        };

        slack.sendMessage("", {
            attachments: [attachment]
        });
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
