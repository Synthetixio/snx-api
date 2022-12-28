#!/bin/bash
home_path=/home/ubuntu
docker_path=$home_path/.docker/cli-plugins

# redis recommended
echo never >/sys/kernel/mm/transparent_hugepage/enabled &&
	echo never >/sys/kernel/mm/transparent_hugepage/defrag &&
	sysctl -w net.core.somaxconn=512 &&
	sysctl vm.overcommit_memory=1

cd $home_path/snx-api &&
	COMPOSE_HTTP_TIMEOUT=200 $docker_path/docker-compose up -d
