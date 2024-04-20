#!/bin/sh
# whitelist domains
printf '"~*(?:\\b)synthetix\.io(?:\\b)" 			0;\n' >>/etc/nginx/bots.d/whitelist-domains.conf
printf '"~*(?:\\b)synthetix\.eth\.limo(?:\\b)" 			0;\n' >>/etc/nginx/bots.d/whitelist-domains.conf
