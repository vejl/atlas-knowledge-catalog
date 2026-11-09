def test_unknown_browser_page_has_branded_html_and_404_status(client):
    response = client.get('/a-page-that-does-not-exist')
    assert response.status_code == 404
    assert response.headers['content-type'].startswith('text/html')
    assert 'Page not found' in response.text
    assert 'href="/#catalog"' in response.text
    assert 'monochrome.css' in response.text
    assert "script-src 'self'" in response.headers['content-security-policy']


def test_api_and_missing_assets_keep_json_errors(client):
    for path in ('/api/not-a-route', '/api/resources/999999', '/static/missing.css', '/samples/missing.csv'):
        response = client.get(path)
        assert response.status_code == 404
        assert response.headers['content-type'].startswith('application/json')
        assert 'detail' in response.json()


def test_http_methods_keep_their_status_and_allow_header(client):
    response = client.post('/api/status')
    assert response.status_code == 405
    assert 'GET' in response.headers['allow']
    assert response.json()['detail']
