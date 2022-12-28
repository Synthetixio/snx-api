#!/bin/sh
# whitelist domains
echo '"~*(?:\b)synthetix\.io(?:\b)" 			0;' >>/etc/nginx/bots.d/whitelist-domains.conf
