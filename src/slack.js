// @flow
import { WebClient, RtmClient, CLIENT_EVENTS, RTM_EVENTS } from "@slack/client";
import config from "./conf";

export type SlackChannel = {|
    id: string
|};

export type SlackMessage = {|
    type: string,
    channel: string,
    user: string,
    text: string,
    ts: number
|};

export type SlackProfile = {|
    email: string,
    image_24: string,
    image_32: string,
    image_48: string,
    image_72: string,
    image_192: string,
    image_512: string
|};

export type SlackTeam = {||};

export type SlackUser = {|
    id: string,
    name: string,
    color: string,
    real_name: string,
    profile: SlackProfile
|};

export type SlackMessageOptions = {|
    attachments?: any
|};

const web = new WebClient(config.slackToken);

const rtm = new RtmClient(config.slackToken, {
    dataStore: false,
    useRtmConnect: true
});

class Slack {
    user: SlackUser;
    team: SlackTeam;
    channel: SlackChannel;

    users: { [id: string]: SlackUser } = {};

    constructor() {
        rtm.start();
    }

    updateUsers = (): Promise<*> =>
        web.users.list().then(list => {
            list.members.forEach(member => {
                this.users[member.id] = member;
            });
        });

    onReady: Promise<void> = new Promise((resolve, reject) => {
        rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, connectData => {
            this.user = connectData.self;
            this.team = connectData.team;
            console.log(`Logged into ${this.team.name} as @${this.user.name}`);
        });

        rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
            web.channels.list().then(list => {
                this.channel = list.channels.find(
                    c => c.name == config.slackChannel
                );
                resolve();
            });
        });
    });

    sendMessage = (
        text: string,
        options: SlackMessageOptions = {}
    ): Promise<SlackMessage> =>
        new Promise((resolve, reject) => {
            function capitalizeFirstLetter(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }

            this.onReady.then(() => {
                web.chat
                    .postMessage(this.channel.id, text, {
                        username: `${capitalizeFirstLetter(
                            config.beverageName
                        )} Bot`,
                        icon_emoji: ":tea:",
                        ...options
                    })
                    .then(resolve)
                    .catch(console.error);
            });
        });

    editMessage = (msg: SlackMessage, text: string): void => {
        web.chat.update(msg.ts, this.channel.id, text).catch(console.error);
    };

    addReaction = (emoji: string, msg: SlackMessage): Promise<void> =>
        new Promise((resolve, react) => {
            this.onReady.then(() => {
                web.reactions.add(emoji, {
                    channel: this.channel.id,
                    timestamp: msg.ts
                });
            });
        });

    messageHandler = (handler: SlackMessage => void) => {
        this.onReady.then(() => {
            rtm.on(RTM_EVENTS.MESSAGE, message => {
                // Skip messages that are from a bot or my own user ID
                if (
                    (message.subtype && message.subtype === "bot_message") ||
                    (!message.subtype && message.user === this.user.id)
                ) {
                    return;
                }

                // Ignore messages in other channels
                if (message.channel != this.channel.id) {
                    return;
                }

                handler(message);
            });
        });
    };

    findUser = (id: string): Promise<SlackUser> =>
        new Promise((resolve, reject) => {
            this.onReady.then(() => {
                if (id in this.users) {
                    resolve(this.users[id]);
                } else {
                    this.updateUsers().then(() => {
                        const user = this.users[id];
                        if (user) {
                            resolve(user);
                        } else {
                            reject();
                        }
                    });
                }
            });
        });
}

export default new Slack();

rtm.start();
