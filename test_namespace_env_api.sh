#!/bin/bash

echo "Testing namespace and environment API integration..."
echo "=================================================="

# Test 1: Get namespaces with Ray clusters
echo "1. Namespaces with Ray clusters:"
curl -s http://localhost:8080/api/namespaces | jq -r '.[].name'

echo ""
echo "2. Environments in 'default' namespace:"
curl -s "http://localhost:8080/api/environments?namespace=default" | jq -r '.[].name'

echo ""
echo "3. Environments in 'ray-test' namespace:"
curl -s "http://localhost:8080/api/environments?namespace=ray-test" | jq -r '.[].name'

echo ""
echo "4. Environments in 'rl' namespace:"
curl -s "http://localhost:8080/api/environments?namespace=rl" | jq -r '.[].name'

echo ""
echo "5. All environments (no namespace filter):"
curl -s "http://localhost:8080/api/environments" | jq -r '.[].name'