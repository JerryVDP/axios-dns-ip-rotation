import dns from 'dns/promises';

const dnsCache = new Map();
const dnsPointer = new Map();

async function getIPs(domain) {
    try {
        if (!dnsCache.has(domain)) {
            const addresses = await dns.resolve(domain);
            dnsCache.set(domain, addresses);
        }
        return dnsCache.get(domain);
    } catch (error) {
        return [];
    }
}

async function getIP(domain) {
    const ips = getIPs(domain);
    if (! ips.length) {
        return null;
    }
    let pointer = dnsPointer.get(domain) || 0;
    const ip = ips[pointer];
    pointer = (pointer+1) % ips.length;
    dnsPointer.set(domain, pointer);
    return ip;
}

export default function (axiosInstance) {
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

        // Set the Host header to the original domain
        config.headers = config.headers || {};
        config.headers.Host = domain;

        return config;
    }, error => {
        return Promise.reject(error);
    });
}