# README #

App for handling my yearly 18-person PGA tournament pool. Has two main modes, Draft (js/components/DraftApp.jsx) and Tournament (js/components/TourneyApp.jsx).

Draft mode runs a snake draft of all the golfers in the current tournament (specified by `yahoo_url` in server/config.js). Each player gets to select 4 golfers. Uses socket.io to update all web clients as players are picked. Sounds 3 bells when it is your turn to pick.

Tournament mode shows live scores for all the golfers, as well as the current standings in our pool. By default, only your golfers are shown, but you can view others' golfers by selecting their name in the Pool Standings.

Note: The app forces you to select who you are for convenience. There is no login or anything, meaning you could potentially log in and pick for someone else. This is a purposeful choice, as we want to optimize for the following:

* Easy adoption. Some of the guys in the league don't have FB and won't want to create an account.
* Easy support for proxy drafting. We often need to draft for someone else who can't make the draft. This is done ad-hoc, and is supported by the user just using multiple browser windows.
* Honor system. We rely on the honor system for this whole thing. No need to enforce complexity with logins.

## Terminology ##

These are referenced all over the code.

* player - A person in our league (not a golfer)
* golfer - A PGA golfer
* tourney - Tournament

## Run webserver locally ##

Requires mongodb and redis instances. See server/config.js default values for setup.

```
npm install
grunt rund
```

Navigate to http://localhost:3000

## Run tests ##

```grunt test```

## Build prod files (checked in) ##

If building, keep in a separate commit in master.

```grunt build```

## Live updating of scores ##

Running the following command will update the scores from Yahoo, based on the URL in server/config.js.

```
node server/runUpdateScore.js
```

In prod, while a tournament is running, I run this command every 10 minutes using a simple cron job. The server is notified immediately via a redis message. The UI is updated immediately via socket.io update.

## Reset data locally ##

It will often be helpful to reset data locally so you can do some manual testing.

```node ./server/refreshData.js```


