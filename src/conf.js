// @flow
if (!process.env.SLACK_TOKEN) {
    throw "You must define a SLACK_TOKEN environment variable";
}

export type configTypes = {|
    slackToken: string,
    slackChannel: string,
    databaseFile: string,
    brewTimeout: number,
    beverageName: string
|};

const config: configTypes = {
    // Slack config
    slackToken: process.env.SLACK_TOKEN,
    slackChannel: process.env.SLACK_ROOM || "tearoom",

    // Database
    databaseFile: process.env.DATABASE_FILE || "./db/sqlite.db",

    // Teabot mechanics config
    brewTimeout: parseInt(process.env.BREW_TIMEOUT || 60 * 0.5),
    beverageName: process.env.BEVERAGE_NAME || "tea"
};

export default config;
