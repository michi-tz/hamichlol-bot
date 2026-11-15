// LOCAL FILE - not synced from upstream.
// Wikidata SPARQL query helpers, adapted from an older version of
// bot/wiki/WikiDataSqlQueries.ts in https://github.com/EladHeller/wiki-bot (ISC).
// That file is empty upstream now, so `npm run sync:parser` does not touch
// this one (it is listed under "localFiles" in upstream.json). See CREDITS.md.
function companiesWithMayaId() {
  return `
SELECT ?entityId ?mayaId ?articleName WHERE {
  ?entity wdt:P10817 ?mayaId.
  ?article schema:about ?entity;
    schema:isPartOf <https://he.wikipedia.org/>;
    schema:name ?articleName.
  BIND(STRAFTER(STR(?entity), "entity/") AS ?entityId)
}`;
}

function personWithBirthdayInDay(day, month) {
  return `
SELECT ?person ?personLabel ?birthDate ?hebrewArticle WHERE {
  ?person wdt:P31 wd:Q5;
    wdt:P569 ?birthDate.
  FILTER(((MONTH(?birthDate)) = ${month} ) && ((DAY(?birthDate)) = ${day} ))
  FILTER(NOT EXISTS { ?person wdt:P570 ?deathDate. })
  ?hebrewArticle schema:about ?person;
    schema:isPartOf <https://he.wikipedia.org/>.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he". }
}`;
}

function companiesWithTicker() {
  return `SELECT ?companyId ?companyLabel ?exchangeLabel ?exchangeShortName ?ticker ?articleName WHERE {
    ?company p:P414 ?statement.
    ?statement ps:P414 ?exchange.
    OPTIONAL { ?statement pq:P249 ?ticker. }
    OPTIONAL { ?exchange wdt:P1813 ?exchangeShortName. }
    ?article schema:about ?company;
            schema:isPartOf <https://he.wikipedia.org/>;
            schema:name ?articleName.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
    BIND(STRAFTER(STR(?company), "entity/") AS ?companyId)
  }`;
}

export {
  companiesWithMayaId,
  personWithBirthdayInDay,
  companiesWithTicker,
};
