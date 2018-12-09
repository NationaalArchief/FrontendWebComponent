import { Component, OnInit, AfterContentInit, Input, Output, EventEmitter } from '@angular/core';
import { SparqlService } from '../sparql.service';
import { ItemData } from '../itemdata';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css']
})
export class ListComponent implements OnInit, AfterContentInit {

  static PREFIXES = `
  PREFIX naa: <http://archief.nl/def/>
  PREFIX hg: <http://rdf.histograph.io/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX dbo: <http://dbpedia.org/ontology/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX imt: <http://immigrants.tutorial/>
  PREFIX pnv: <https://w3id.org/pnv#>`;

  itemsDict: { [uri: string]: ItemData } = {};

  @Input() items: ItemData[] = [];
  @Input() template = null;
  @Input() templateRole = 'default';
  @Input() multiSelect = 'true';
  @Input() dataChanged: Observable<any>;
  @Output() select: EventEmitter<ItemData[]> = new EventEmitter();

  itemsSubscription: any;

  constructor(
    protected sparqlService: SparqlService) { }

  ngOnInit() {
    // if (this.template) {
    //   window[this.template] = this;
    // }
    this.getRDF();
    if (this.dataChanged) {
      this.subscribeToEvents();
    }
  }

  protected subscribeToEvents() {
    this.itemsSubscription = this.dataChanged.subscribe((event) => this.onSelect(event));
  }

  ngAfterContentInit() {
    // console.log('ngAfterContentInit() for ', this.items);
  }

  onClick(item: ItemData): void {
    if (this.multiSelect !== 'true') {
      // console.log('resettng for ', this.template);
      this.resetSelection(item);
    }
    item.selected = item.selected ? false : true;
    this.emitSelection();
    // console.log('clicked: ', item);
  }

  protected setDefaultSelection(): void {
    if (this.items && this.items.length) {
      const item = this.items[0];
      item.selected = true;
      this.emitSelection();
    }
  }

  private resetSelection(item: ItemData): void {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] !== item) {
        this.items[i].selected = false;
      }
    }
  }

  private emitSelection(): void {
    const items: ItemData[] = [];
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].selected) {
        items.push(this.items[i]);
      }
    }
    this.select.emit(items);
  }

  onSelect(items: ItemData[]): void {
    if (items.length) {
      if (items[0].template === this.template) {
        // console.log('This was me sending the event, ignoring: ', items[0].template);
      } else if (items[0].templateRole === 'content') {
        // console.log(' Or it was content doing something: ', this.templateRole);
      } else {
        // console.log('received some things: ', items);
        this.query(items);
      }
    } else {
      // console.log('received empty argument');
      this.getRDF();
    }
  }

  protected getRDF(): void {
    let query: string;
    switch (this.template) {
      // NOT USED
      case '-person':
        query = `
        ${ListComponent.PREFIXES}
        select ?uri ?name ?firstName ?infix ?surname ?place where {
          ?uri a pnv:Person ;
          naa:hasResidency ?place ;
          pnv:hasName ?nameURI .
          optional { ?nameURI pnv:literalName ?name } .
          optional { ?nameURI pnv:firstName ?firstName } .
          optional { ?nameURI pnv:infix ?infix } .
          optional { ?nameURI pnv:surname ?surname } .
        } limit 100`;
        break;
      // NOT USED
      case '-place':
        query = `
        ${ListComponent.PREFIXES}
          select ?uri ?name (count(?residents) as ?hits) where {
	          ?uri dct:type hg:Place ;
            rdfs:label ?name .
            ?residents naa:hasResidency ?uri
          }
          group by ?uri ?name
          order by desc(?hits)`;
        break;

      case 'province':
        query = `
        ${ListComponent.PREFIXES}
        select ?uri ?name (count(?residents) as ?hits) where {
	      ?uri dct:type hg:Province ;
        rdfs:label ?name .
        ?place hg:liesIn ?uri .
        ?residents naa:hasResidency ?place
        }
        group by ?uri ?name
        order by desc(?hits)`;
        break;

      default:
        break;
    }
    // console.log('Query: ', query);
    if (query) {
      this.sparqlService.getRDF(query)
        .subscribe(data => {
          this.cleanupData();
          this.parseResults(data);
          if (this.template === 'province') {
            this.setDefaultSelection();
          }
        });
    }
  }

  protected getPersonsQuery(items: ItemData[]): string {
    return `
    ${ListComponent.PREFIXES}
    select ?uri ?name ?firstName ?infix ?surname ?place ?province where {
      ?uri a pnv:Person ;
      pnv:hasName ?nameURI .
      optional { ?nameURI pnv:literalName ?name } .
      optional { ?nameURI pnv:firstName ?firstName } .
      optional { ?nameURI pnv:infix ?infix } .
      optional { ?nameURI pnv:surname ?surname } .
      ${items.filter(item => item.template === 'place').map(item => `?uri dbo:residence <${item.uri}> .`).join(' ')}
      ?uri dbo:residence ?residence .
      ${items.filter(item => item.template === 'province').map(item => `?residence hg:liesIn <${item.uri}> .`).join(' ')}
      ?residence hg:liesIn ?province
    } limit 100`;
  }

  protected getPlaceQuery(items: ItemData[]): string {
    return `
    ${ListComponent.PREFIXES}
    select distinct ?uri ?name (count(?residents) as ?hits) ?province where {
      ?uri dct:type hg:Place ;
      rdfs:label ?name .
      ?residents dbo:residence ?uri .
      ${items.map(item => `?uri hg:liesIn <${item.uri}> .`).join(' ')}
      ?uri hg:liesIn ?province
    }
    group by ?uri ?name ?province
    order by desc(?hits)`;
  }

  protected getProvinceQuery(items: ItemData[]): string {
    return `
    ${ListComponent.PREFIXES}
    select ?uri ?name (count(?residents) as ?hits) where {
    ?uri dct:type hg:Province ;
    rdfs:label ?name .
    ?place hg:liesIn ?uri .
    ?residents dbo:residence ?place
    }
    group by ?uri ?name
    order by desc(?hits)`;
  }


  protected query(items: ItemData[]): void {
    let query: string = null;
    switch (this.template) {
      case 'person':
        // console.log('person needs updating based on items: ', items);
        query = this.getPersonsQuery(items);
        break;

      case 'place':
        query = this.getPlaceQuery(items);
        break;

      case 'province':
        // query = this.getProvinceQuery(items);
        return;
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
          if (this.template === 'person') {
            this.setDefaultSelection();
          }
        });
    }
  }

  protected cleanupData(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i] = null;
    }
    this.items = [];
    this.itemsDict = {};
  }

  protected parseResults(results: any): void {
    // console.log ('results: ', results);
    let resultData: any;
    const tempDict: { [uri: string]: ItemData } = {};
    let itemdata: ItemData;
    let key: string;
    let name: string;
    let hits: number;
    for (let i = 0; i < results['results']['bindings'].length; i++) {
      resultData = results['results']['bindings'][i];
      key = resultData['uri'] ? resultData['uri']['value'] : null;
      name = resultData['name'] ? resultData['name']['value'] : null;
      hits = resultData['hits'] ? resultData['hits']['value'] : null;
      if (null == tempDict[key]) {
        itemdata = new ItemData();
        tempDict[key] = itemdata;
      } else {
        itemdata = tempDict[key];
      }
      itemdata.uri = key;
      itemdata.hits = hits;
      itemdata.name = name;
      itemdata.label = name;
      itemdata.templateRole = this.templateRole;
      itemdata.template = this.template;
      if (itemdata.name && itemdata.name !== '') {
        if (this.itemsDict[itemdata.uri] == null) {
          this.itemsDict[itemdata.uri] = itemdata;
          this.items.push(itemdata);
        } else {
          // console.log('Duplicate item found: ', itemdata);
        }
      } else {
        // console.log('Item without a name found: ', itemdata);
      }
    }
  }
}
