# Fastfood System: ett distribuerat ordersystem

Det här är ett eventdrivet ordersystem för snabbmatskedjor, inspirerat av hur det fungerar på till exempel Max eller McDonalds. 

Systemet består av fristående mikrotjänster som kommunicerar asynkront via RabbitMQ och sparar information i egna PostgreSQL-databaser. All trafik utifrån går igenom en gemensam Nginx-gateway.

## Förutsättningar
* **Docker och Docker Compose** installerat på din maskin (för att köra applikationen).
* **Node.js** installerat på din maskin (för att köra testerna).

## Starta systemet

Starta hela miljön med följande kommando:

bash
docker compose up --build


Detta bygger containrarna, förbereder databaserna (order_db, product_db och kitchen_db), lägger till standardprodukterna i menyn och startar Nginx-gatewayen på port 80.

## API och anropsvägar

Eftersom all extern trafik går via Nginx på port 80 använder du bas-URL:en `http://localhost/` för att prata med systemet.

### Produkter (Product Service)
* Hämta produkter och menyer:
  `GET http://localhost/api/products`
* Lägg till en produkt i menyn:
  `POST http://localhost/api/products`
  JSON-body: `{"name": "Hamburgare", "price": 99}`

### Ordrar (Order Service)
* Skapa en ny order:
  `POST http://localhost/api/orders`
  JSON-body: `{"customerId": "Kalle", "items": [{"id": 1, "name": "Falafelburgare", "quantity": 1}]}`
  Du får tillbaka statuskod 201 Created och ett orderId.
* Hämta orderstatus:
  `GET http://localhost/api/orders/<orderId>`

### Köket (Kitchen Service)
* Hämta alla beställningar i köket:
  `GET http://localhost/api/kitchen/orders`
* Markera en beställning som klar (motsvarar att kökspersonalen trycker på skärmen):
  `POST http://localhost/api/kitchen/orders/<orderId>/complete`

## Tester

Projektet har både enhetstester och integrationstester.

> Innan du kör testerna lokalt på din maskin måste du först installera testverktygen. Ställ dig i projektets rotmapp och kör:

> bash
> npm install


### Enhetstester
Dessa testar valideringslogik (som UUID-kontroller och orderstrukturer) med Node.js inbyggda testverktyg.
Kör testerna lokalt med:

bash
npm run test:unit

### Integrationstester
Integrationstesterna i Cypress går igenom hela flödet från menyval och orderläggning till klarmarkering i köket.
Kör testerna med:

bash
npm run test


### Automatisk testning i GitHub
Varje gång du pushar kod till main branschen körs hela testsviten automatiskt i GitHub Actions (se inställningarna i .github/workflows/ci.yml).
