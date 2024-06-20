import dns from 'dns/promises';

let globalDebug = false;
const dnsCache = new Map();
const domainIndex = new Map();

async function getIPs(domain) {
    try {
        if (!dnsCache.has(domain)) {
            const entries = await dns.lookup(domain, {all: true});
            const addresses = [];
            for (const entry of entries) {
                addresses.push(entry.address);
            }
            if (globalDebug)
                console.log(`DNS [MISS]: ${domain} -> `, addresses);

            dnsCache.set(domain, addresses);
            return addresses;
        } else {
            if (globalDebug)
                console.log(`DNS [HIT]: ${domain} -> `, dnsCache.get(domain));
            return dnsCache.get(domain);
        }
    } catch (error) {
        if (globalDebug)
            console.log(`DNS [FAIL]: ${domain} -> `, error);
        return [];
    }
}

async function getIP(domain) {
    const ips = await getIPs(domain);
    if (! ips.length) {
        return null;
    }
    const index = domainIndex.get(domain) || 0;
    domainIndex.set(domain, (index+1) % ips.length);
    const ip = ips[index];
    if (globalDebug) {
        console.log(`DNS ${domain} -> ${ip} using index=${index}`);
    }
    return ip;
}

export default function (axiosInstance, debug=false) {
    globalDebug = debug;
    axiosInstance.interceptors.request.use(async config => {
        // Extract the hostname from the URL
        const url = new URL(config.url);
        const domain = url.hostname;

        // Get rotated IP
        const ip = await getIP(domain);
        if (! ip) {
            return config;
        }

        // Update the URL in the config to use the selected IP
        url.hostname = ip;
        config.url = url.toString();

        if (globalDebug) {
            console.log(`DNS URL ${domain} => ${config.url}`);
        }

        // Set the Host header to the original domain
        config.headers = config.headers || {};
        config.headers.Host = domain;

        return config;
    }, error => {
        return Promise.reject(error);
    });
}