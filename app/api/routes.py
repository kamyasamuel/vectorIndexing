from fastapi import APIRouter
from .controllers import router as controller_router

# This is a pass-through router that imports from controllers
# You could add additional routes or middleware here if needed
router = APIRouter()
router.include_router(controller_router)
