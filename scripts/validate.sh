#!/bin/bash

echo "Waiting for 60 seconds before checking health.."
sleep 60

status_code=$(curl --write-out "%{http_code}" --silent --output /dev/null http://localhost:80/status)
if [[ $status_code -ne 200 ]]; then
	echo "App is not healthy - status code: $status_code"
	curl -v http://localhost:80/status
	exit 1
else
	echo "App is responding with status code: $status_code"
	exit 0
fi
