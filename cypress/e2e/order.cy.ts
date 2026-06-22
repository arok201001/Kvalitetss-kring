describe('Fastfood System E2E & Integrationstester', () => {

  it('Ska kunna hämta alla produkter och menyer från product-service', () => {
    cy.request('GET', '/api/products').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    });
  });

  it('Ska kunna lägga till en ny produkt och verifiera att den finns i menyn', () => {
    const newProduct = {
      name: `Cypress_Hamburgare_${Date.now()}`,
      price: 119
    };
    cy.request('POST', '/api/products', newProduct).then((postResponse) => {
      expect(postResponse.status).to.eq(201);
      expect(postResponse.body).to.have.property('id');
      expect(postResponse.body.name).to.eq(newProduct.name);
      
      cy.request('GET', '/api/products').then((getResponse) => {
        expect(getResponse.status).to.eq(200);
        const addedProduct = getResponse.body.find((p: any) => p.name === newProduct.name);
        expect(addedProduct).to.not.be.undefined;
        expect(addedProduct.price).to.eq(newProduct.price);
      });
    });
  });

  it('Ska neka produktinläggning med 400 Bad Request om priset är ogiltigt', () => {
    cy.request({
      method: 'POST',
      url: '/api/products',
      failOnStatusCode: false,
      body: { name: "Ogiltig produkt", price: -5 }
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('Ska skicka en giltig order och få 201 Created', () => {
    cy.request('POST', '/api/orders', {
      customerId: "Arkan_Mac_Test",
      items: [{ id: 1, name: "Falafelburgare", quantity: 1 }]
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('orderId');
    });
  });

  it('Ska neka ordern med 400 Bad Request om items-listan är tom', () => {
    cy.request({
      method: 'POST',
      url: '/api/orders',
      failOnStatusCode: false,
      body: { customerId: "Arkan_Fel_Test", items: [] }
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('Ska ge 400 om man försöker hämta en order med ogiltigt format', () => {
    cy.request({
      method: 'GET',
      url: '/api/orders/invalid-uuid-123',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('Ska ge 404 om man försöker hämta en order som inte existerar', () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    cy.request({
      method: 'GET',
      url: `/api/orders/${fakeUuid}`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it('Komplett E2E Flöde: Order -> Kök -> Klar -> Notifikation', () => {
    const customer = `Cypress_E2E_${Date.now()}`;
    
    cy.request('POST', '/api/orders', {
      customerId: customer,
      items: [
        { id: 1, name: "Falafelburgare", quantity: 2 }
      ]
    }).then((postResponse) => {
      expect(postResponse.status).to.eq(201);
      const orderId = postResponse.body.orderId;
      
      cy.request('GET', `/api/orders/${orderId}`).then((getResponse) => {
        expect(getResponse.status).to.eq(200);
        expect(getResponse.body.customerId).to.eq(customer);
        expect(["PENDING", "PREPARING"]).to.include(getResponse.body.status);
      });
      
      cy.wait(2000);
      
      cy.request('GET', '/api/kitchen/orders').then((kitchenResponse) => {
        expect(kitchenResponse.status).to.eq(200);
        const kitchenOrder = kitchenResponse.body.find((o: any) => o.id === orderId);
        expect(kitchenOrder).to.not.be.undefined;
        expect(kitchenOrder.status).to.eq("PREPARING");
      });
      
      cy.request('POST', `/api/kitchen/orders/${orderId}/complete`).then((completeResponse) => {
        expect(completeResponse.status).to.eq(200);
        expect(completeResponse.body.success).to.be.true;
      });
      
      cy.request({
        method: 'POST',
        url: `/api/kitchen/orders/${orderId}/complete`,
        failOnStatusCode: false
      }).then((completeResponse2) => {
        expect(completeResponse2.status).to.eq(400);
      });
      
      cy.wait(2000);
      
      cy.request('GET', `/api/orders/${orderId}`).then((readyResponse) => {
        expect(readyResponse.status).to.eq(200);
        expect(readyResponse.body.status).to.eq("READY");
      });
      
      cy.request('GET', `/api/notifications?customerId=${customer}`).then((notifResponse) => {
        expect(notifResponse.status).to.eq(200);
        expect(notifResponse.body.length).to.be.greaterThan(0);
        expect(notifResponse.body[0].orderId).to.eq(orderId);
        expect(notifResponse.body[0].message).to.include("redo för upphämtning");
      });
    });
  });

});