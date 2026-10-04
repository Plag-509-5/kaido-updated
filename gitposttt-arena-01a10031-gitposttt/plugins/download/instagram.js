const axios = require('axios');

function normalise(value) {
  const root = value?.result || value?.data || value;
  if (Array.isArray(root)) return root.map(x => typeof x === 'string' ? { url: x } : x).filter(x => x?.url || x?.download_url);
  if (root?.picker && Array.isArray(root.picker)) return root.picker.map(x => ({ url: x.url, type: x.type || 'image' }));
  const urls = [root?.url, root?.download_url, root?.hd, root?.sd, root?.video, root?.image].filter(Boolean);
  return urls.map(url => ({ url, type: /\.mp4(?:\?|$)/i.test(url) ? 'video' : 'image' }));
}

async function downloadInstagram(url) {
  // Cobalt renvoie des liens directs et gère les reels, posts et carrousels.
  const cobaltEndpoints = [
    process.env.COBALT_API_URL || 'https://api.cobalt.tools/api/json',
    'https://cobalt-api.kwiatekmiki.com/'
  ];
  for (const endpoint of cobaltEndpoints) {
    try {
      const response = await axios.post(endpoint, { url, downloadMode: 'auto', filenameStyle: 'basic' }, {
        headers: { 'content-type': 'application/json', accept: 'application/json' }, timeout: 30000
      });
      const media = normalise(response.data);
      if (media.length) return media;
    } catch (e) { console.warn('[IG cobalt failed]', endpoint, e.response?.status || e.message); }
  }

  const providers = [
    () => axios.get('https://api.giftedtech.web.id/api/download/instagram', { params: { apikey: 'gifted', url }, timeout: 20000 }),
    () => axios.get('https://api.nexoracle.com/downloader/insta', { params: { url, apikey: 'free_key' }, timeout: 20000 })
  ];
  for (const provider of providers) {
    try {
      const media = normalise((await provider()).data);
      if (media.length) return media;
    } catch (e) { console.warn('[IG provider failed]', e.response?.status || e.message); }
  }
  throw new Error('Impossible de télécharger ce média Instagram. Le compte est privé, le lien est invalide ou les fournisseurs sont momentanément indisponibles.');
}

module.exports = {
  name: 'instagram',
  alias: ['ig', 'reels', 'insta', 'igdl'],
  category: 'download',
  description: 'Télécharge une vidéo, reel ou photo depuis Instagram',
  usage: '.ig <lien Instagram>',
  async execute({ socket, msg, from, args, prefix }) {
    const url = args[0];
    if (!url || !/(instagram\.com|instagr\.am)/i.test(url)) return socket.sendMessage(from, { text: `📸 Usage : ${prefix}ig https://www.instagram.com/reel/...` }, { quoted: msg });
    await socket.sendMessage(from, { text: '⏳ Téléchargement du média Instagram...' }, { quoted: msg });
    try {
      const mediaList = await downloadInstagram(url);
      let sent = 0;
      for (const item of mediaList.slice(0, 10)) {
        const itemUrl = typeof item === 'string' ? item : item.url || item.download_url;
        if (!itemUrl) continue;
        const isVideo = item.type === 'video' || /\.(mp4|mov)(?:\?|$)/i.test(itemUrl);
        await socket.sendMessage(from, isVideo
          ? { video: { url: itemUrl }, caption: '📸 *Instagram Reel/Vidéo* — KAIDO-MD' }
          : { image: { url: itemUrl }, caption: '📸 *Instagram Photo* — KAIDO-MD' }, { quoted: msg });
        sent++;
      }
      if (!sent) throw new Error('Le fournisseur n’a renvoyé aucun média exploitable');
    } catch (err) {
      console.error('[INSTAGRAM ERROR]', err);
      await socket.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg });
    }
  }
};
