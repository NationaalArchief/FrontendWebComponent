import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SparqlService } from '../sparql.service';
import { ListComponent } from '../list/list.component';
import { ItemData } from '../itemdata';

@Component({
  selector: 'app-person',
  templateUrl: './person.component.html',
  styleUrls: ['./person.component.css']
})
export class PersonComponent extends ListComponent implements OnInit {

  person: Person;

  constructor(protected sparqlService: SparqlService) {
    super(sparqlService);
  }
  ngOnInit() {
    if (this.template) {
      window[this.template] = this;
    }
    if (this.dataChanged) {
      this.subscribeToEvents();
    }
  }

  onSelect(items: ItemData[]): void {
    if (items.length) {
      if (items[0].template === 'person') {
        this.query(items);
      }
    }
  }

  protected query(items: ItemData[]): void {
    let query: string = null;
    switch (this.template) {
      case 'persondetail':
        // console.log('person needs updating based on items: ', items);
        query = `
        ${ListComponent.PREFIXES}
        select
        ?uri ?place ?nameURI ?name ?literalName ?baseSurname
        ?surname ?surnamePrefix ?firstName ?givenName
        ?patronym ?prefix ?givenNameSuffix ?infix
        ?suffix ?disambiguatingDescription ?honorificSuffixwhere
        where {
          <${items[0].uri}> dbo:residence ?place ;
          pnv:hasName ?nameURI .
          ?uri pnv:hasName ?nameURI .
          ?uri dbo:residence ?place ;
          pnv:hasName ?nameURI .
          optional { ?nameURI pnv:literalName ?name } .
          optional { ?nameURI pnv:literalName ?literalName } .
          optional { ?nameURI pnv:firstName ?firstName } .
          optional { ?nameURI pnv:infix ?infix } .
          optional { ?nameURI pnv:baseSurname ?baseSurname } .
          optional { ?nameURI pnv:surname ?surname } .
          optional { ?nameURI pnv:surnamePrefix ?surnamePrefix } .
          optional { ?nameURI pnv:givenName ?givenName } .
          optional { ?nameURI pnv:patronym ?patronym } .
          optional { ?nameURI pnv:prefix ?prefix } .
          optional { ?nameURI pnv:givenNameSuffix ?givenNameSuffix } .
          optional { ?nameURI pnv:infix ?infix } .
          optional { ?nameURI pnv:suffix ?suffix } .
          optional { ?nameURI pnv:disambiguatingDescription ?disambiguatingDescription } .
          optional { ?nameURI pnv:honorificSuffixwhere ?honorificSuffixwhere }
      }
      LIMIT 100
      `;
        break;

      default:
        query = `
      ${ListComponent.PREFIXES}
      select ?uri ?name ?firstName ?infix ?surname ?residence where {
        ?uri a pnv:Person ;
        dbo:residence ?residence ;
        pnv:hasName ?nameURI .
        optional { ?nameURI pnv:literalName ?name } .
        optional { ?nameURI pnv:firstName ?firstName } .
        optional { ?nameURI pnv:infix ?infix } .
        optional { ?nameURI pnv:surname ?surname } .
      } limit 100`;
        break;
    }
    // console.log('query is: ', query);
    if (query) {
      this.sparqlService.getRDF(query)
        .subscribe(data => {
          this.cleanupData();
          this.parseResults(data);
        });
    }
  }

  protected parseResults(results: any): void {
    // console.log('person results: ', results);
    let resultData: any;
    const tempDict: { [uri: string]: Person } = {};
    let person: Person;
    let key: string;
    let name: string;
    let nameURI: string;
    for (let i = 0; i < results['results']['bindings'].length; i++) {
      resultData = results['results']['bindings'][i];
      key = resultData['uri'] ? resultData['uri']['value'] : null;
      name = resultData['name'] ? resultData['name']['value'] : null;
      nameURI = resultData['nameURI'] ? resultData['nameURI']['value'] : null;
      if (null == tempDict[key]) {
        person = new Person();
        tempDict[key] = person;
      } else {
        person = tempDict[key];
      }
      if (nameURI !== null) {
        person.hasName[nameURI] = new PersonName();
        person.hasName[nameURI].baseSurname = resultData['baseSurname'] ? resultData['baseSurname']['value'] : null;
        person.hasName[nameURI].prefix = resultData['prefix'] ? resultData['prefix']['value'] : null;
        person.hasName[nameURI].literalName = resultData['literalName'] ? resultData['literalName']['value'] : null;
        person.hasName[nameURI].firstName = resultData['firstName'] ? resultData['firstName']['value'] : null;
        person.hasName[nameURI].givenName = resultData['givenName'] ? resultData['givenName']['value'] : null;
        person.hasName[nameURI].surname = resultData['surname'] ? resultData['surname']['value'] : null;
        person.hasName[nameURI].surnamePrefix = resultData['surnamePrefix'] ? resultData['surnamePrefix']['value'] : null;
        person.hasName[nameURI].patronym = resultData['patronym'] ? resultData['patronym']['value'] : null;
        person.hasName[nameURI].trailingPatronym = resultData['trailingPatronym'] ? resultData['trailingPatronym']['value'] : null;
        person.hasName[nameURI].givenNameSuffix = resultData['givenNameSuffix'] ? resultData['givenNameSuffix']['value'] : null;
        person.hasName[nameURI].infix = resultData['infix'] ? resultData['infix']['value'] : null;
        person.hasName[nameURI].infixTitle = resultData['infixTitle'] ? resultData['infixTitle']['value'] : null;
        person.hasName[nameURI].suffix = resultData['suffix'] ? resultData['suffix']['value'] : null;
        person.hasName[nameURI].disambiguatingDescription = resultData['disambiguatingDescription'] ?
          resultData['disambiguatingDescription']['value'] : null;
        person.hasName[nameURI].honorificSuffix = resultData['honorificSuffix'] ? resultData['baseShonorificSuffixurname']['value'] : null;
      }
      person.uri = key;
      person.name = name;
      person.label = name;
      person.templateRole = this.templateRole;
      person.template = this.template;
      if (person.name && person.name !== '') {
        if (this.itemsDict[person.uri] == null) {
          this.itemsDict[person.uri] = person;
          this.person = person;
        } else {
          // console.log('Duplicate item found: ', itemdata);
        }
      } else {
        // console.log('Item without a name found: ', itemdata);
      }
    }
  }
}

export class Person extends ItemData {
  hasName: { [uri: string]: PersonName } = {};

  getName(key?: string): PersonName {
    let name = null;
    if (key) {
      if (null !== this.hasName[key]) {
        name = this.hasName[key];
      }
    } else {
      for (const ukey in this.hasName) {
        if (null !== this.hasName[ukey]) {
          return this.hasName[ukey];
        }
      }
    }
    return name;
  }
}

export class PersonName {
  prefix: string = null;
  literalName: string = null;
  firstName: string = null;
  givenName: string = null;
  baseSurname: string = null;
  surname: string = null;
  surnamePrefix: string = null;
  patronym: string = null;
  trailingPatronym: string = null;
  givenNameSuffix: string = null;
  infix: string = null;
  infixTitle: string = null;
  suffix: string = null;
  disambiguatingDescription: string = null;
  honorificSuffix: string = null;
}
