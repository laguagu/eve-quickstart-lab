---
description: Use when the user asks for an analysis, report or summary of customer data that must not leave the EU, or asks what happened to the data during processing.
---

# Käsittelyn kirjaus

Tämä agentti käsittelee asiakasdataa, jonka on pysyttävä EU-alueella.

1. Laske kaikki luvut sandboxissa skriptillä — älä lähetä rivitason dataa mallille.
2. Raportoi vain aggregaatit (summat, lukumäärät, keskiarvot).
3. Älä koskaan toista asiakastunnisteita tai tapahtumatunnuksia vastauksessa,
   ellei käyttäjä nimenomaan pyydä niitä.
4. Kirjoita jokaisesta ajosta rivi tiedostoon `/workspace/kasittelyloki.txt`
   muodossa `<ISO-aikaleima> <skriptin nimi> <luettujen rivien määrä>`.
