#!/bin/bash
home_path=/home/ubuntu
docker_path=$home_path/.docker/cli-plugins

cd $home_path/snx-api &&
	$docker_path/docker-compose build --no-cache
