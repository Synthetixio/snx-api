#!/bin/bash
home_path=/home/ubuntu
bin_path=/usr/bin
docker_path=$home_path/.docker/cli-plugins

cd $home_path/snx-api

echo "docker-compose down"
$docker_path/docker-compose down

echo "docker system prune --all --volumes --force"
$bin_path/docker system prune --all --volumes --force
