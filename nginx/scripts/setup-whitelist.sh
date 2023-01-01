#!/bin/sh
# whitelist domains
printf '"~*(?:\\b)synthetix\.io(?:\\b)" 			0;\n' >>/etc/nginx/bots.d/whitelist-domains.conf
