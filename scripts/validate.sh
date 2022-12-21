#!/bin/bash

result=$(curl -s http://localhost:80/status)

if [[ $result =~ "OK" ]]; then
	exit 0
else
	exit 1
fi
