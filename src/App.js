import React, { useState } from 'react';
import { FileText, Lock, Unlock, Download, CheckCircle, Shield, AlertCircle } from 'lucide-react';
import CryptoJS from 'crypto-js';

const CompressionApp = () => {
  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState(1);
  const [symboles, setSymboles] = useState([]);
  const [codes, setCodes] = useState({});
  const [compresse, setCompresse] = useState('');
  const [cle, setCle] = useState('');
  const [chiffre, setChiffre] = useState('');
  const [recupere, setRecupere] = useState('');
  const [metriques, setMetriques] = useState(null);

  class Noeud {
    constructor(char, freq, g = null, d = null) {
      this.char = char;
      this.freq = freq;
      this.g = g;
      this.d = d;
    }
  }

  const analyser = () => {
    const freq = {};
    for (let c of texte) freq[c] = (freq[c] || 0) + 1;
    const total = texte.length;
    const arr = Object.entries(freq).map(([c, f]) => ({
      symbole: c === '\n' ? '\\n' : c === ' ' ? '␣' : c,
      char: c,
      freq: f,
      prob: ((f / total) * 100).toFixed(2)
    })).sort((a, b) => b.freq - a.freq);
    setSymboles(arr);
    setEtape(2);
  };

  const construireHuffman = () => {
    const freq = {};
    for (let c of texte) freq[c] = (freq[c] || 0) + 1;
    const noeuds = Object.entries(freq).map(([c, f]) => new Noeud(c, f));
    
    // Cas spécial: un seul symbole unique
    if (noeuds.length === 1) {
      const map = {};
      map[noeuds[0].char] = '0';
      setCodes(map);
      setEtape(3);
      return;
    }
    
    while (noeuds.length > 1) {
      noeuds.sort((a, b) => a.freq - b.freq);
      const g = noeuds.shift();
      const d = noeuds.shift();
      noeuds.push(new Noeud(null, g.freq + d.freq, g, d));
    }
    const generer = (n, code = '', map = {}) => {
      if (!n) return map;
      if (n.char !== null) {
        map[n.char] = code || '0';
        return map;
      }
      generer(n.g, code + '0', map);
      generer(n.d, code + '1', map);
      return map;
    };
    setCodes(generer(noeuds[0]));
    setEtape(3);
  };

  const encoder = () => {
    let enc = '';
    for (let c of texte) enc += codes[c];
    setCompresse(enc);
    setEtape(4);
  };

  const chiffrer = () => {
    // Génération d'une clé AES-256 aléatoire (32 octets = 256 bits)
    const cleAleatoire = CryptoJS.lib.WordArray.random(32);
    const cleHex = cleAleatoire.toString(CryptoJS.enc.Hex);
    
    // NOUVELLE APPROCHE : Chiffrer directement la chaîne binaire comme du texte
    // Cela évite les problèmes de conversion binaire<->hex
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Chiffrement AES-256 de la chaîne binaire directement
    const encrypted = CryptoJS.AES.encrypt(
      compresse, // La chaîne binaire "010110..." directement
      cleAleatoire,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    // Stockage de la clé, IV et texte chiffré
    const donneesChiffrees = {
      iv: iv.toString(CryptoJS.enc.Hex),
      chiffre: encrypted.toString() // Format standard CryptoJS (Base64)
    };
    
    setCle(cleHex);
    setChiffre(JSON.stringify(donneesChiffrees));
    setEtape(5);
  };

  const dechiffrer = () => {
    try {
      // Parsing des données chiffrées
      const donneesChiffrees = JSON.parse(chiffre);
      
      // Reconstruction de la clé et de l'IV
      const cleWord = CryptoJS.enc.Hex.parse(cle);
      const ivWord = CryptoJS.enc.Hex.parse(donneesChiffrees.iv);
      
      // Déchiffrement AES
      const decrypted = CryptoJS.AES.decrypt(
        donneesChiffrees.chiffre, // Format Base64 standard
        cleWord,
        {
          iv: ivWord,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      
      // Conversion du résultat en chaîne (notre binaire)
      const dec = decrypted.toString(CryptoJS.enc.Utf8);
      
      // Vérification que le déchiffrement a fonctionné
      if (!dec || !/^[01]+$/.test(dec)) {
        throw new Error('Déchiffrement invalide');
      }
      
      // Décodage Huffman
      const inv = {};
      for (let [c, code] of Object.entries(codes)) inv[code] = c;
      
      let txt = '', curr = '';
      for (let b of dec) {
        curr += b;
        if (inv[curr]) {
          txt += inv[curr];
          curr = '';
        }
      }
      
      // Vérification qu'il ne reste pas de bits non décodés
      if (curr !== '') {
        console.warn('Bits restants non décodés:', curr);
      }
      
      setRecupere(txt);
      calculer(txt);
      setEtape(6);
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      setRecupere('');
      calculer('');
      setEtape(6);
    }
  };

  const calculer = (txt) => {
    const tOrig = texte.length * 8;
    const tComp = compresse.length;
    const probs = symboles.map(s => parseFloat(s.prob) / 100);
    const H = -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
    let L = 0;
    for (let s of symboles) {
      L += (parseFloat(s.prob) / 100) * codes[s.char].length;
    }
    setMetriques({
      tOrig,
      tComp,
      H: H.toFixed(4),
      L: L.toFixed(4),
      eff: ((H / L) * 100).toFixed(2),
      red: (100 - (H / L) * 100).toFixed(2),
      taux: ((1 - tComp / tOrig) * 100).toFixed(2),
      ratio: (tOrig / tComp).toFixed(3),
      gain: tOrig - tComp,
      ok: txt === texte
    });
  };

  const telecharger = () => {
    if (!metriques || !metriques.ok) {
      alert('Impossible de générer le rapport : la vérification a échoué');
      return;
    }
    
    const donneesChiffrees = JSON.parse(chiffre);
    let r = `═══════════════════════════════════════════════════════════════
RAPPORT : COMPRESSION ET CHIFFREMENT DE TEXTE
═══════════════════════════════════════════════════════════════

Date: ${new Date().toLocaleDateString('fr-FR')}
Algorithme: Huffman (optimal)
Chiffrement: AES-256 (CBC mode)

═══════════════════════════════════════════════════════════════
1. TEXTE ORIGINAL
═══════════════════════════════════════════════════════════════

${texte}

Caractères: ${texte.length} | Taille: ${texte.length * 8} bits | Symboles: ${symboles.length}

═══════════════════════════════════════════════════════════════
2. ANALYSE DES SYMBOLES (triés par fréquence décroissante)
═══════════════════════════════════════════════════════════════

`;
    symboles.forEach((s, i) => {
      r += `${(i + 1).toString().padStart(3)}. '${s.symbole.padEnd(3)}' | Fréq: ${s.freq.toString().padStart(4)} | Prob: ${s.prob.padStart(6)}% | Code: ${codes[s.char]}\n`;
    });

    r += `
═══════════════════════════════════════════════════════════════
3. CODES DE HUFFMAN
═══════════════════════════════════════════════════════════════

`;
    Object.entries(codes).forEach(([c, code]) => {
      const d = c === '\n' ? '\\n' : c === ' ' ? '␣' : c;
      r += `'${d}' → ${code}\n`;
    });

    r += `
═══════════════════════════════════════════════════════════════
4. COMPRESSION
═══════════════════════════════════════════════════════════════

Texte compressé (extrait binaire):
${compresse.substring(0, 500)}${compresse.length > 500 ? '...' : ''}

Longueur: ${compresse.length} bits

═══════════════════════════════════════════════════════════════
5. CHIFFREMENT AES-256
═══════════════════════════════════════════════════════════════

Clé AES (256 bits / 64 hex):
${cle}

IV (128 bits / 32 hex):
${donneesChiffrees.iv}

Texte chiffré (Base64):
${donneesChiffrees.chiffre.substring(0, 500)}${donneesChiffrees.chiffre.length > 500 ? '...' : ''}

Mode: CBC (Cipher Block Chaining)
Padding: PKCS7
Format: Base64 (standard CryptoJS)

═══════════════════════════════════════════════════════════════
6. VÉRIFICATION
═══════════════════════════════════════════════════════════════

${metriques.ok ? '✅ SUCCÈS - Texte identique à l\'original' : '❌ ÉCHEC'}

═══════════════════════════════════════════════════════════════
7. ANALYSE DE L'EFFICACITÉ
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ Taille originale        │ ${metriques.tOrig.toString().padStart(8)} bits          │
│ Taille compressée       │ ${metriques.tComp.toString().padStart(8)} bits          │
│ Gain d'espace           │ ${metriques.gain.toString().padStart(8)} bits          │
│ Taux de compression     │ ${metriques.taux.toString().padStart(8)}%              │
│ Ratio                   │ ${metriques.ratio.toString().padStart(8)}:1            │
├─────────────────────────────────────────────────────────────┤
│ Entropie (H)            │ ${metriques.H.padStart(8)} bits/symbole   │
│ Longueur moyenne (L)    │ ${metriques.L.padStart(8)} bits/symbole   │
│ Efficacité              │ ${metriques.eff.padStart(8)}% (H/L × 100)  │
│ Redondance              │ ${metriques.red.padStart(8)}% (100 - η)    │
└─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
SÉCURITÉ
═══════════════════════════════════════════════════════════════

✅ Algorithme: AES-256 (Standard de chiffrement avancé)
✅ Mode: CBC avec IV aléatoire unique
✅ Clé: 256 bits générée aléatoirement
✅ Résistance: Sécurité militaire et gouvernementale
✅ Format: Base64 standard pour compatibilité maximale

═══════════════════════════════════════════════════════════════
Fin du rapport
═══════════════════════════════════════════════════════════════
`;
    const blob = new Blob([r], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_AES256_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setTexte('');
    setEtape(1);
    setSymboles([]);
    setCodes({});
    setCompresse('');
    setCle('');
    setChiffre('');
    setRecupere('');
    setMetriques(null);
  };

  const exemple = `La théorie de l'information, développée par Claude Shannon en 1948, constitue le fondement mathématique de la communication numérique. Elle quantifie l'information, définit l'entropie comme mesure de l'incertitude, et établit les limites théoriques de la compression et de la transmission des données.`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Compression et Chiffrement de Texte
              </h1>
              <p className="text-gray-600 text-lg">De la Théorie de l'Information à la Sécurité des Données</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span>🔧 <strong>Huffman</strong></span>
                <span>🔐 <strong>AES-256</strong></span>
                <span>🛡️ <strong>CBC Mode</strong></span>
                <span>📊 <strong>6 étapes</strong></span>
              </div>
            </div>
            <Shield className="w-16 h-16 text-blue-600 opacity-20" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {['Texte', 'Analyse', 'Huffman', 'Compression', 'Chiffrement AES', 'Résultats'].map((nom, i) => (
              <div
                key={i}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                  etape > i + 1 ? 'bg-green-500 text-white' :
                  etape === i + 1 ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}
              >
                {i + 1}. {nom}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 border border-blue-100">
          
          {etape === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 1 : Choix du texte</h2>
              <textarea
                className="w-full h-56 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                placeholder="Entrez votre texte..."
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
              />
              <div className="text-sm text-gray-600">
                Caractères: {texte.length}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={analyser}
                  disabled={!texte}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-bold transition"
                >
                  Analyser →
                </button>
                <button
                  onClick={() => setTexte(exemple)}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition"
                >
                  Exemple
                </button>
              </div>
            </div>
          )}

          {etape === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 2 : Analyse statistique</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Caractères</div>
                  <div className="text-2xl font-bold text-blue-600">{texte.length}</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Symboles uniques</div>
                  <div className="text-2xl font-bold text-indigo-600">{symboles.length}</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Taille</div>
                  <div className="text-2xl font-bold text-purple-600">{texte.length * 8} bits</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white sticky top-0">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Symbole</th>
                      <th className="p-2">Fréq</th>
                      <th className="p-2">Prob</th>
                      <th className="p-2">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symboles.map((s, i) => (
                      <tr key={i} className="border-b hover:bg-gray-100">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono font-bold">{s.symbole}</td>
                        <td className="p-2 text-right">{s.freq}</td>
                        <td className="p-2 text-right">{s.prob}%</td>
                        <td className="p-2">
                          <div className="bg-gray-200 h-4 rounded">
                            <div className="bg-blue-500 h-4 rounded transition-all" style={{ width: `${s.prob}%` }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={construireHuffman}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
              >
                Construire Huffman →
              </button>
            </div>
          )}

          {etape === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 3 : Arbre de Huffman</h2>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-green-700 font-semibold">✅ Arbre construit - Codes optimaux générés</p>
                <p className="text-sm text-green-600 mt-1">
                  {Object.keys(codes).length} code{Object.keys(codes).length > 1 ? 's' : ''} généré{Object.keys(codes).length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                <h3 className="font-bold mb-2">Codes de Huffman</h3>
                {Object.entries(codes).map(([c, code], i) => {
                  const d = c === '\n' ? '\\n' : c === ' ' ? '␣' : c;
                  return (
                    <div key={i} className="flex justify-between p-2 border-b font-mono text-sm hover:bg-gray-100">
                      <span className="font-bold">'{d}'</span>
                      <span className="text-blue-600">{code}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={encoder}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
              >
                Encoder →
              </button>
            </div>
          )}

          {etape === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 4 : Compression</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">Texte compressé (binaire)</h3>
                <div className="text-xs font-mono bg-white p-3 rounded border break-all max-h-48 overflow-auto">
                  {compresse.substring(0, 1000)}{compresse.length > 1000 && '...'}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Longueur: <span className="font-bold">{compresse.length}</span> bits 
                  <span className="ml-4">Réduction: <span className="font-bold text-green-600">
                    {((1 - compresse.length / (texte.length * 8)) * 100).toFixed(1)}%
                  </span></span>
                </p>
              </div>
              <button
                onClick={chiffrer}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 transition"
              >
                <Lock className="w-5 h-5" />
                Chiffrer avec AES-256 →
              </button>
            </div>
          )}

          {etape === 5 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 5 : Chiffrement AES-256</h2>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-bold text-blue-800">Sécurité de niveau militaire</span>
                </div>
                <p className="text-sm text-blue-700">
                  AES-256 en mode CBC avec IV aléatoire - Standard utilisé par les gouvernements
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">Clé AES-256 (64 caractères hexadécimaux)</h3>
                  <div className="text-xs font-mono bg-white p-2 rounded border break-all">
                    {cle}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">Données chiffrées (JSON avec IV et Ciphertext)</h3>
                  <div className="text-xs font-mono bg-white p-2 rounded border break-all max-h-32 overflow-auto">
                    {chiffre}
                  </div>
                </div>
              </div>
              <button
                onClick={dechiffrer}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 transition"
              >
                <Unlock className="w-5 h-5" />
                Déchiffrer et Vérifier →
              </button>
            </div>
          )}

          {etape === 6 && metriques && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Étape 6 : Résultats</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <div className="text-sm text-gray-600">Taille originale</div>
                  <div className="text-2xl font-bold text-blue-600">{metriques.tOrig} bits</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                  <div className="text-sm text-gray-600">Taille compressée</div>
                  <div className="text-2xl font-bold text-green-600">{metriques.tComp} bits</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                  <div className="text-sm text-gray-600">Taux compression</div>
                  <div className="text-2xl font-bold text-purple-600">{metriques.taux}%</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Entropie (H)</div>
                  <div className="text-lg font-bold">{metriques.H}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Long. moy (L)</div>
                  <div className="text-lg font-bold">{metriques.L}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Efficacité</div>
                  <div className="text-lg font-bold">{metriques.eff}%</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Ratio</div>
                  <div className="text-lg font-bold">{metriques.ratio}:1</div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${metriques.ok ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
                <div className="flex items-center gap-2">
                  {metriques.ok ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <span className="font-bold text-green-700">✅ Vérification réussie ! Texte identique à l'original.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <div>
                        <span className="font-bold text-red-700">❌ Erreur de vérification</span>
                        <p className="text-sm text-red-600 mt-1">
                          Le texte récupéré ne correspond pas à l'original. Cela peut être dû à un problème de chiffrement/déchiffrement.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={telecharger}
                  disabled={!metriques.ok}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center gap-2 transition"
                >
                  <Download className="w-5 h-5" />
                  Télécharger rapport
                </button>
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition"
                >
                  Nouveau projet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompressionApp;
