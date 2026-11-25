import { describe, expect, it } from 'vitest';
import { isLoopback, joinUrl, readJoinCode } from '../src/net/joinLink';
import { pickLanUrl } from '../server/lanUrl';

describe('lien pour rejoindre (QR code)', () => {
  it('ajoute le code du salon à l’adresse du jeu', () => {
    expect(joinUrl('http://192.168.1.12:5173', 'abcd')).toBe('http://192.168.1.12:5173/?code=ABCD');
  });

  it('donne l’adresse seule tant que le code n’existe pas, sans chemin ni paramètres', () => {
    expect(joinUrl('http://192.168.1.12:5173/lobby?x=1#y')).toBe('http://192.168.1.12:5173/');
  });

  it('lit un code valide dans la barre d’adresse, en majuscules', () => {
    expect(readJoinCode('?code=wxyz')).toBe('WXYZ');
    expect(readJoinCode('?foo=1&code=ABCD')).toBe('ABCD');
  });

  it('ignore un code absent ou mal formé', () => {
    expect(readJoinCode('')).toBeNull();
    expect(readJoinCode('?code=AB')).toBeNull();
    expect(readJoinCode('?code=AB12')).toBeNull();
    expect(readJoinCode('?code=ABCDE')).toBeNull();
  });

  it('reconnaît une page ouverte en local', () => {
    expect(isLoopback('localhost:5173')).toBe(true);
    expect(isLoopback('127.0.0.1:5173')).toBe(true);
    expect(isLoopback('[::1]:5173')).toBe(true);
    expect(isLoopback('192.168.1.12:5173')).toBe(false);
  });
});

describe('adresse réseau local de l’hôte', () => {
  it('préfère le réseau domestique ou d’école aux interfaces virtuelles', () => {
    expect(pickLanUrl(['http://172.20.0.1:5173/', 'http://10.0.0.5:5173/', 'http://192.168.1.12:5173/'])).toBe('http://192.168.1.12:5173');
    expect(pickLanUrl(['http://172.20.0.1:5173/', 'http://10.0.0.5:5173/'])).toBe('http://10.0.0.5:5173');
  });

  it('ne renvoie rien sans --host ou avec seulement des adresses inutilisables', () => {
    expect(pickLanUrl(undefined)).toBeNull();
    expect(pickLanUrl([])).toBeNull();
    expect(pickLanUrl(['http://169.254.3.4:5173/', 'http://[fe80::1]:5173/'])).toBeNull();
  });
});

describe('adresse réseau local : cartes virtuelles', () => {
  const urls = ['http://192.168.56.1:5199/', 'http://192.168.192.1:5199/', 'http://192.168.74.1:5199/', 'http://10.192.177.0:5199/'];

  it('prend la carte de la route par défaut (wifi) plutôt que VirtualBox ou VMware', () => {
    expect(pickLanUrl(urls, '10.192.177.0')).toBe('http://10.192.177.0:5199');
  });

  it('sans route connue, évite au moins le réseau VirtualBox', () => {
    expect(pickLanUrl(['http://192.168.56.1:5199/', 'http://10.0.0.5:5199/'], null)).toBe('http://10.0.0.5:5199');
  });
});
