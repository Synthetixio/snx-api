#!/bin/bash
home_path=/home/ubuntu
bin_path=$home_path/bin
docker_path=$home_path/.docker/cli-plugins

export COMPOSE_HTTP_TIMEOUT=200

cd $home_path/snx-api &&
	$bin_path/docker volume prune --force &&
	$docker_path/docker-compose up -d
