import { Component, OnInit, AfterViewInit, AfterViewChecked } from '@angular/core';
import { SparqlService } from '../sparql.service';
import { ListComponent } from '../list/list.component';
import { icon, latLng, Map, marker, point, polyline, tileLayer, LatLngExpression } from 'leaflet';
import { SearchService } from '../search.service';
import { ItemData } from '../itemdata';
import { Observable } from 'rxjs';

declare let L;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent extends ListComponent implements OnInit, AfterViewInit, AfterViewChecked {

  map: Map;
  province: string;
  place: string;

  protected mapServiceURL = 'http://localhost:32768/styles/osm-bright/{z}/{x}/{y}.png';

  maps = tileLayer(this.mapServiceURL,
    {
      detectRetina: false
    });

  options = {
    layers: [
      this.maps
    ],
    zoom: 8,
    preferCanvas: true,
    center: latLng([52.08095165, 5.12768031549829])
  };

  constructor(protected sparqlService: SparqlService,
    protected searchService: SearchService) {
    super(sparqlService);
  }

  ngAfterViewInit() {
  }

  ngAfterViewChecked() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  search(query: string) {
    // console.log('search query: ', query);
    this.searchService.search(query).subscribe(data => {
      if (data.length) {
        const coords = data[0];
        if (coords['lat'] && coords['lon']) {
          const lat: number = coords['lat'];
          const lon: number = coords['lon'];
          // console.log('retreived cords: ', lon , lat);
          let zoom = 10;
          if (this.place) {
            zoom = 12;
          }
          // this.map.panTo([lat, lon], {animate: true, duration: 1});
          this.map.flyTo([lat, lon], zoom, {animate: true, duration: 2});
        }
      }
    });
  }

  getFindProvinceByPlaceQuery(placeURI: string): string {
    return `
      PREFIX hg: <http://rdf.histograph.io/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      select ?uri ?name ?province where {
	      ?uri dct:type hg:Province ;
        rdfs:label ?name .
        <${placeURI}> hg:liesIn ?uri .
      }`;
  }

  protected query(items: ItemData[]): void {
    // console.log('map received items: ', items);
    let query: string = null;
    if (items.length) {
      switch (items[0].template) {
        case 'province':
          this.province = items[0].name;
          this.place = null;
          this.search(this.province);
          break;

        case 'place':
          this.place = items[0].name;
          this.province = null;
          query = this.getFindProvinceByPlaceQuery(items[0].uri);
          break;

        default:
          console.log('no hit on place template for map');
          break;
      }
      if (query) {
        this.sparqlService.getRDF(query)
          .subscribe(data => {
            this.cleanupData();
            this.parseResults(data);
            if (this.place && this.province) {
              this.search(`${this.place}, ${this.province}`);
            }
          });
      }
    }
  }

  ngOnInit() {
    // only for debugging!
    if (this.template) {
      window[this.template] = this;
    }
    if (this.dataChanged) {
      this.subscribeToEvents();
    }
  }

  onMapReady(map: Map) {
    this.map = map;
  }

  protected parseResults(results: any): void {
    console.log ('results: ', results);
    let resultData: any;
    let key: string;
    let name: string;
    for (let i = 0; i < results['results']['bindings'].length; i++) {
      resultData = results['results']['bindings'][i];
      key = resultData['uri'] ? resultData['uri']['value'] : null;
      name = resultData['name'] ? resultData['name']['value'] : null;
      if (name && this.province === null) {
        this.province = name;
        console.log('we now have a place and province ', this.place, this.province);
        return;
      }
    }
  }
}
