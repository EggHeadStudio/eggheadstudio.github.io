# Helppoa kotiruokaa

Staattinen, suomenkielinen reseptikorttisovellus, joka näyttää yhden edullisen arjen ruoan kerrallaan. Käyttäjä voi pyyhkäistä reseptien välillä ja tallentaa näkymän kuvana puhelimeen.

## Vaatimukset

- Moderni selain (Chrome, Safari, Edge, Firefox)
- Kehitystilassa tarvittaessa kevyt http-palvelin (esim. `npx serve`, `python3 -m http.server`)

## Kehityksen käynnistys

1. Kloonaa tai lataa projekti koneellesi.
2. Avaa hakemisto `Helppoa_kotiruokaa` VS Codessa tai muussa editorissa.
3. Jos haluat paikallisen esikatselun, käynnistä yksinkertainen palvelin hakemistossa:
   - Node: `npx serve .`
   - Python: `python3 -m http.server`
4. Avaa selaimessa osoite, jonka palvelin ilmoittaa (esim. <http://localhost:5000> tai <http://localhost:8000>).

## Testauslista

Suorita nämä manuaaliset tarkistukset ennen julkaisua:

1. **Lataus** – sivu aukeaa nopeasti mobiili- ja työpöytäselaimella, reseptit tulevat näkyviin.
2. **Pyyhkäisy** – vasen/oikea -swaippaus toimii iOS- ja Android-selaimissa ilman viiveitä.
3. **Painikkeet** – `Edellinen`, `Seuraava`, `Yllätä minut` ja `Tallenna kuvana` toimivat myös näppäimistöllä (nuolinäppäimet).
4. **Kuvankaappaus** – `Tallenna kuvana` luo PNG-tiedoston, jossa näkyy koko kortti ilman vierityspalkkeja.
5. **Tyylit** – kortin ulkoasu skaalautuu 360 px leveälle näytölle; varmistu että tekstit ovat luettavia.
6. **Virheilmoitukset** – katkaise verkkoyhteys ja varmista, että sovellus ilmoittaa selkeästi jos reseptit eivät lataudu.
7. **Reseptidata** – selaa kaikki reseptit läpi ja varmista, että kuvat, ainekset ja ohjeet vastaavat JSON-tietoja.

## Julkaisu GitHub Pagesiin

1. Lisää ja commitoi muutokset:
   ```bash
   git add .
   git commit -m "Julkaisu Helppoa kotiruokaa -sovellus"
   ```
2. Pushaa repositorion `main`-haaraan:
   ```bash
   git push origin main
   ```
3. Avaa GitHubissa repositorion **Settings** → **Pages** -osio.
4. Valitse **Source**-kentästä `Deploy from a branch` ja haaraksi `main`, kansioksi `/ (root)`.
5. Tallenna asetukset. Ensimmäinen julkaisu kestää muutaman minuutin.
6. Kun GitHub Pages ilmoittaa onnistuneesta julkaisusta, avaa tarjottu URL puhelimella ja tarkista testauslistan kohdat vielä kerran.

## Rakenne

```
root/
├── index.html        # Käyttöliittymän pohja
├── style.css         # Mobiilioptimoidut tyylit
├── app.js            # Reseptien logiikka, pyyhkäisy ja kuvankaappaus
├── reseptit.json     # Suomenkielinen reseptidata
├── kuvat/            # Paikkakuvat reseptikorteille
└── README.md         # Tämä ohje
```

## Mukautus

- Lisää omia reseptejä muokkaamalla `reseptit.json`-tiedostoa ja liittämällä vastaavat kuvat `kuvat/`-kansioon.
- Päivitä `style.css`, jos haluat eri värimaailman tai typografian.
- Mikäli lisäät ulkoisia kirjastoja, varmista että polut ovat suhteellisia ja toimivat GitHub Pagesissa.

Hyviä kokkaushetkiä!
