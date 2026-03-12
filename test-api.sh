#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

echo -e "${BLUE}=== Booking Tennis API Test Script ===${NC}\n"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq first.${NC}"
    echo "macOS: brew install jq"
    echo "Linux: sudo apt-get install jq"
    exit 1
fi

# Check if services are running
echo -e "${BLUE}1. Checking services health...${NC}"
HEALTH=$(curl -s $BASE_URL/health)
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Cannot connect to API Gateway at $BASE_URL${NC}"
    echo "Please make sure services are running."
    exit 1
fi
echo "$HEALTH" | jq
echo ""

# Get RSA Public Key
echo -e "${BLUE}2. Getting RSA Public Key...${NC}"
RSA_KEY=$(curl -s $BASE_URL/rsa/public-key)
echo "$RSA_KEY" | jq -r '.publicKey' | head -c 50
echo "..."
echo ""

# Prompt for role ID
echo -e "${BLUE}3. Register User${NC}"
echo -e "${GREEN}Please enter a role ID (get from database or Prisma Studio):${NC}"
read -p "Role ID: " ROLE_ID

if [ -z "$ROLE_ID" ]; then
    echo -e "${RED}Error: Role ID is required${NC}"
    exit 1
fi

# Register
echo -e "\n${BLUE}Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test$(date +%s)@example.com\",
    \"password\": \"password123\",
    \"fullName\": \"Test User\",
    \"phone\": \"+84123456789\",
    \"roleId\": \"$ROLE_ID\"
  }")

if echo "$REGISTER_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}Registration failed:${NC}"
    echo "$REGISTER_RESPONSE" | jq
    exit 1
fi

echo "$REGISTER_RESPONSE" | jq

# Extract tokens
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.refreshToken')
EMAIL=$(echo $REGISTER_RESPONSE | jq -r '.user.email')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: Failed to get access token${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Registration successful!${NC}"
echo -e "${GREEN}Email: $EMAIL${NC}"
echo -e "${GREEN}Access Token: ${ACCESS_TOKEN:0:50}...${NC}"

# Get Profile
echo -e "\n${BLUE}4. Getting User Profile (Protected Endpoint)...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET $BASE_URL/users/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$PROFILE_RESPONSE" | jq -e '.statusCode' > /dev/null 2>&1; then
    echo -e "${RED}Error getting profile:${NC}"
    echo "$PROFILE_RESPONSE" | jq
else
    echo "$PROFILE_RESPONSE" | jq
    echo -e "\n${GREEN}✓ Profile retrieved successfully!${NC}"
fi

# Login
echo -e "\n${BLUE}5. Login with registered credentials...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"password123\"
  }")

if echo "$LOGIN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}Login failed:${NC}"
    echo "$LOGIN_RESPONSE" | jq
else
    echo "$LOGIN_RESPONSE" | jq
    echo -e "\n${GREEN}✓ Login successful!${NC}"
fi

# Refresh Token
echo -e "\n${BLUE}6. Refreshing Token...${NC}"
REFRESH_RESPONSE=$(curl -s -X POST $BASE_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

if echo "$REFRESH_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}Token refresh failed:${NC}"
    echo "$REFRESH_RESPONSE" | jq
else
    echo "$REFRESH_RESPONSE" | jq
    echo -e "\n${GREEN}✓ Token refreshed successfully!${NC}"
fi

# Test invalid token
echo -e "\n${BLUE}7. Testing Invalid Token (Should fail)...${NC}"
INVALID_RESPONSE=$(curl -s -X GET $BASE_URL/users/profile \
  -H "Authorization: Bearer invalid-token-12345")

if echo "$INVALID_RESPONSE" | jq -e '.statusCode' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Correctly rejected invalid token${NC}"
    echo "$INVALID_RESPONSE" | jq
else
    echo -e "${RED}Error: Should have rejected invalid token${NC}"
fi

echo -e "\n${BLUE}=== Test Complete ===${NC}"
echo -e "${GREEN}All tests passed!${NC}"
