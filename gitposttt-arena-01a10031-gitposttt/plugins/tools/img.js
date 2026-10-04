const axios = require('axios');
const cheerio = require('cheerio');
const { generateWAMessageContent, generateWAMessageFromContent, proto } = require('@rexxhayanasi/elaina-baileys');

async function searchImages(query, limit = 6) {
  // Bing expose l'URL originale dans l'attribut JSON `m` (contrairement aux
  // miniatures lazy-loaded de Google qui donnaient toujours une liste vide).
  const { data } = await axios.get('https://www.bing.com/images/search', {
    params: { q: query, form: 'HDRSC2', first: 1 },
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    timeout: 20000
  });
  const $ = cheerio.load(data);
  const urls = [];
  $('.iusc').each((_, el) => {
    try {
      const meta = JSON.parse($(el).attr('m') || '{}');
      const url = meta.murl || meta.turl;
      if (url && /^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url);
    } catch (_) {}
  });
  // Fallback pour les pages Bing dont la structure HTML change.
  if (!urls.length) {
    for (const match of String(data).matchAll(/\"murl\":\"(https?:\/\/[^\"]+)/g)) {
      const url = match[1].replace(/\\\//g, '/');
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return urls.slice(0, limit);
}

module.exports = {
  name: 'img',
  alias: ['image', 'images', 'image-search'],
  category: 'tools',
  description: "Recherche des images et les affiche dans un carrousel",
  usage: '.img <recherche>',
  async execute({ socket, msg, from, args, prefix }) {
    const query = args.join(' ').trim();
    if (!query) {
      return socket.sendMessage(from, { text: `🔎 Usage : ${prefix}img <mot-clé>\nExemple : ${prefix}img paysages d'Haïti` }, { quoted: msg });
    }

    await socket.sendMessage(from, { react: { text: '🔎', key: msg.key } });
    try {
      const urls = await searchImages(query);
      if (!urls.length) throw new Error('Aucune image trouvée');
      const cards = [];
      for (const url of urls) {
        try {
          const media = await generateWAMessageContent({ image: { url } }, { upload: socket.waUploadToServer });
          cards.push({
            body: { text: `🖼️ ${query}` },
            header: { title: 'Résultat image', hasMediaAttachment: true, imageMessage: media.imageMessage },
            nativeFlowMessage: { buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Ouvrir', url }) }] }
          });
        } catch (e) { console.warn('[IMG] image ignorée:', e.message); }
      }
      if (!cards.length) throw new Error('Les images trouvées ne sont pas accessibles');
      const interactive = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({ text: `🖼️ Résultats pour : ${query}` }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: 'KAIDO-MD • Glisse pour voir les images' }),
        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({ cards, messageVersion: 1 })
      });
      const wa = generateWAMessageFromContent(from, { viewOnceMessage: { message: { interactiveMessage: interactive } } }, { quoted: msg, userJid: socket.user?.id });
      await socket.relayMessage(from, wa.message, { messageId: wa.key.id });
      await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      console.error('[IMG ERROR]', err);
      await socket.sendMessage(from, { text: `❌ Recherche d'images impossible : ${err.message}` }, { quoted: msg });
    }
  }
};
