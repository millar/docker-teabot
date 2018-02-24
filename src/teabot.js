// @flow
import moment from "moment";
import { Op } from "sequelize";
import config from "./conf";
import Round from "./round";
import slack from "./slack";
import { random } from "./utils";
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

    get round(): ?Round {
        return this._round && this._round.active ? this._round : null;
    }

    set round(value: Round) {
        this._round = value;
    }

    startRound = (user: SlackUser, ...args): void => {
        if (!this.round) {
            this.round = new Round(user, this.completeRound, ...args);
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
            const pattern = new RegExp(
                "\\s*<@" + RegExp.escape(slack.user.id) + ">:?\\s(.*)"
            );
            const match = message.text.match(pattern);
            if (match) {
                // Ensure user is in database
                const slackUser = await slack.findUser(message.user);
                const user = await User.fromSlack(slackUser);

                const command = match[1];
                this.processCommand(command, user, message);
            }
        });
    }

    processCommand(command: string, user: User, message: SlackMessage) {
        const commands = [
            [["register", "update"], this.register],
            [["brew", `:${config.beverageName}:`], this.brew],
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
            // TODO: advise user to add 'brew' as a notification word in slack settings
            user.registered
                ? `I've updated your ${config.beverageName} preference`
                : `Welcome to the ${config.beverageName} party ${user.name}`
        );

        user.tea_type = preference;
        user.save();
    };

    brew = async (user: User, args: string, message: SlackMessage) => {
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
        const text = `<@${user.slack_id}>${user.badge} is making ${
            config.beverageName
        }. Who's in?`;
        slack.addReaction(
            random(["tea", "coffee", "raised_hands", "thumbsup", "clap"]),
            message
        );
        return await slack.sendMessage(text);
    };

    nominate = async (
        user: User,
        lookup: string = "",
        message: SlackMessage
    ) => {
        // TODO: check nomination points

        const pattern = /<@(.+)>/i;
        const match = lookup.match(pattern);

        if (!match) {
            slack.sendMessage(
                `To nominate you must specify a valid user e.g. \`@${
                    slack.user.name
                } nominate @fred\``
            );
            return;
        }

        const nominee = await User.findOne({ where: { slack_id: match[1] } });

        if (!nominee && nominee.registered) {
            slack.sendMessage("User not found!");
            return;
        }

        if (this.round) {
            slack.sendMessage(
                this.round.server.id == user.id
                    ? `You have already offered to make ${config.beverageName}!`
                    : `${this.round.server.name} is already making ${
                          config.beverageName
                      }!`
            );
            return;
        }

        this.startRound(nominee, user);
        const text = `<@${user.slack_id}>${user.badge} has nominated <@${
            nominee.slack_id
        }>${nominee.badge} to make ${config.beverageName}! Who wants some?`;
        slack.addReaction(random(["scream"]), message);
        return await slack.sendMessage(text);
    };

    me = async (user: User, args: string, message: SlackMessage) => {
        if (!user.registered) {
            slack.sendMessage(
                `You must register your ${
                    config.beverageName
                } preference first. Try \`@${slack.user.name} register milky ${
                    config.beverageName
                } with sugar\``
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

        if (this.round.hasCustomer(user)) {
            slack.sendMessage(`You said it once already ${user.name}.`);
            return;
        }

        this.round.addCustomer(user);
        ["thumbsup", user.badge ? user.badge.replace(/:/g, "") : "tea"].forEach(
            emoji => slack.addReaction(emoji, message)
        );
    };

    leaderboard = async (user: User, since) => {
        let date = moment().subtract({ months: 1 });
        if (since) {
            date = moment(since);
        }
        const users = await User.getRanksSince(date);

        const lines = users.map((user, idx) => {
            return `${idx + 1}. _${user.name}_ has brewed *${user.get(
                "total"
            )}* cups of ${config.beverageName}`;
        });

        slack.sendMessage("", {
            attachments: [
                {
                    title: `Leaderboard since ${date.format("MMMM Do YYYY")}`,
                    text: lines.join("\n"),
                    mrkdwn_in: ["text", "pretext"]
                }
            ]
        });
    };

    directory = async (user: User) => {
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

    stats = async (user: User) => {
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

    info = async (user: User, lookup: string = "") => {
        // TODO: remove @ prefix and trim lookup
        const pattern = /<@(.+)>/i;
        const match = lookup.match(pattern);

        if (!match) {
            slack.sendMessage(
                `To get user info please specify a valid user e.g. \`@${
                    slack.user.name
                } info @bob\``
            );
            return;
        }

        const matchingUser = await User.findOne({
            where: { slack_id: match[1] }
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

    hello = (user: User) => {
        slack.sendMessage(`Hello ${user.name}! :wave:`);
    };

    timer = () =>
        this.round
            ? slack.sendMessage(
                  `:timer_clock: ${this.round.timeRemaining ||
                      0} seconds remaining...`
              )
            : slack.sendMessage(`No one is making ${config.beverageName}`);

    help = () => slack.sendMessage(HELP_TEXT);
    ping = () => slack.sendMessage("Pong! :table_tennis_paddle_and_ball:");
}
