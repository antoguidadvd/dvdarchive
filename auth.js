const SECRET_KEY = "ct5Qn8W6Ee61QPr"; 
const STORED_HASH = "ffc517f360f65d641d867b505b83d2d75bffc807b7ad65a386f45ed65de0c92c"; 

async function verifyPassword(inputPassword) {
    try {
        const currentHash = await computeHMAC(inputPassword, SECRET_KEY);
        return currentHash === STORED_HASH;
    } catch (e) {
        console.error("Errore validazione:", e);
        return false;
    }
}

async function computeHMAC(message, key) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', 
        keyData, 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
}