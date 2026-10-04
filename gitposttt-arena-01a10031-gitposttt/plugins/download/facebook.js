const axios = require('axios');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

async function downloadWithYtDlp(url) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kaido-fb-'));
  const output = path.join(dir, 'video.%(ext)s');
  try {
    await ytdlp(url, {
      output,
      format: 'bv*+ba/b',
      mergeOutputFormat: 'mp4',
      noPlaylist: true,
      maxFilesize: '100M',
      retries: 2,
      socketTimeout: 30,
      noWarnings: true
    });
    const file = (await fs.readdir(dir)).find(x => /\.(mp4|webm|mkv)$/i.test(x));
    if (!file) throw new Error('yt-dlp n’a produit aucun fichier');
    return { buffer: await fs.readFile(path.join(dir, file)), cleanup: () => fs.remove(dir) };
  } catch (e) { await fs.remove(dir); throw e; }
}

function normalise(data) {
  const root = data?.result || data?.data || data;
  const videoUrl = root?.hd || root?.hd_url || root?.high || root?.sd || root?.sd_url || root?.video || root?.url || root?.links?.[0]?.url;
  return videoUrl ? { title: root.title || root.caption || 'Facebook Video', videoUrl } : null;
}

async function downloadFacebook(url) {
  const providers = [
    () => axios.get('https://api.giftedtech.web.id/api/download/facebook', { params: { apikey: 'gifted', url }, timeout: 20000 }),
    () => axios.get('https://api.ryzendesu.vip/api/downloader/facebook', { params: { url }, timeout: 20000 })
  ];
  for (const provider of providers) {
    try {
      const data = normalise((await provider()).data);
      if (data) return data;
    } catch (e) { console.warn('[FB provider failed]', e.response?.status || e.message); }
  }
  throw new Error('Impossible de télécharger cette vidéo Facebook. Elle est peut-être privée ou le lien a expiré.');
}

module.exports = {
  name: 'facebook',
  alias: ['fb', 'fbdl', 'fbvideo'],
  category: 'download',
  description: 'Télécharge une vidéo depuis Facebook',
  usage: '.fb <lien Facebook>',
  async execute({ socket, msg, from, args, prefix }) {
    const url = args.join(' ').trim();
    if (!url || !/(facebook\.com|fb\.watch)/i.test(url)) return socket.sendMessage(from, { text: `👥 Usage : ${prefix}fb https://fb.watch/...` }, { quoted: msg });
    await socket.sendMessage(from, { text: '⏳ Récupération de la vidéo Facebook...' }, { quoted: msg });
    try {
      // Téléchargement local : évite les URLs signées expirées renvoyées par les APIs.
      let local;
      try { local = await downloadWithYtDlp(url); }
      catch (e) { console.warn('[FB yt-dlp fallback]', e.message); }
      if (local) {
        try {
          await socket.sendMessage(from, { video: local.buffer, caption: '👥 *Facebook Video* — KAIDO-MD', mimetype: 'video/mp4' }, { quoted: msg });
        } finally { await local.cleanup(); }
      } else {
        const data = await downloadFacebook(url);
        await socket.sendMessage(from, { video: { url: data.videoUrl }, caption: `👥 *Facebook Video* — KAIDO-MD\\n📌 ${data.title}`, mimetype: 'video/mp4' }, { quoted: msg });
      }
    } catch (err) {
      console.error('[FB ERROR]', err);
      await socket.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg });
    }
  }
};
