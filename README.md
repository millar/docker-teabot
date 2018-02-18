# Teabot

## How to run
```sh
docker run millar/teabot -e SLACK_TOKEN=your_slack_token
```

### Configuration
There are some options that can be configured with environment variables passed to the `docker run` command:

* `SLACK_TOKEN` (required) - a Slack access token (should start with xoxp, xoxb, or xoxa)
* `SLACK_CHANNEL` (default = 'tearoom')
