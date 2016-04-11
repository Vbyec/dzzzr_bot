# Dzzzr_bot
Telegram bot for night-game like Dozor (https://classic.dzzzr.ru/moscow/)

## Installation

```sh
$ npm i 
```
For comfortable usage recommended to install screen

For Debian-based OS:
``` sh
$ sudo apt-get install screen
```
## Add team setting (required)

```json
{
  "token": BOT_TOKEN,
  "bot_name": BOT_NAME,
  "log_path": LOG_DIR_PATH,
  "engine":SELECTED_ENGINE
}
```

## Team setting for engine (optional). 
Add this lines to the config file;

##### Dzzzr_light:

``` json
"light": {
    "pin": 123456
  }
```

##### Dzzzr_classic:

``` json
"classic": {
    "login": DZZZR_USER_NAME,
    "password": DZZZR_USER_PASSWORD,
    "http_login": HTTP_TEAM_LOGIN,
    "http_password": HTTP_TEAM_PASSWORD
  }
```

##### Dzzzr_mera:

``` json
 "mera": {
    "login": TEAM,
    "password":PASSWORD
  }
```

## Starting bot

``` sh
$ npm start
```
