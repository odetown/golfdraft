#!/bin/bash

## crontab example
##
## */10 * * * * ~/golfdraft/ec2_runUpdateScore.sh
##

cd ~/
source config.sh

date=`date +%Y%m%d%H%M%S`

logdir=/var/log/golfdraft
logfile="${logdir}/log.${date}.log"

cd golfdraft
git checkout master
git pull origin master
npm install
npm run updateScore > $logfile 2>&1

echo "DONE!"
